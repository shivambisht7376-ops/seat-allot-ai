/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { DbService } from './db.js';

// Initialize server-side Google GenAI client
const apiKey = process.env.GEMINI_API_KEY;

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing. AI features will fallback to custom rules.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'MOCK_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

interface GeminiAssistantResponse {
  answer: string;
  actionExecuted: string | null;
  updatedEmployee?: any;
  suggestions: string[];
}

/**
 * Highly optimized context fetcher to supply Gemini with exact data for the query.
 * For example, if user asks "Who sits at F2-ZA-105?", we fetch seat F2-ZA-105.
 * If user asks "Where does Robert Chen sit?", we find Robert Chen.
 */
function gatherQueryContext(queryText: string): any {
  const queryLower = queryText.toLowerCase();
  const context: any = {};

  // Check for specific seat match (e.g. F2-ZA-123)
  const seatMatch = queryLower.match(/f[1-4]-z[a-d]-\d{3}/);
  if (seatMatch) {
    const seatId = seatMatch[0].toUpperCase();
    const employee = DbService.getEmployeeBySeat(seatId);
    context.targetSeat = seatId;
    context.seatedEmployee = employee || 'None (Seat is currently vacant)';
  }

  // Check for employee ID match (e.g. EMP-1234)
  const empIdMatch = queryLower.match(/emp-\d{4}/);
  if (empIdMatch) {
    const empId = empIdMatch[0].toUpperCase();
    const employee = DbService.getEmployeeById(empId);
    context.targetEmployee = employee || 'None (Employee ID does not exist)';
  }

  // Fuzzy search if names or terms mentioned
  if (queryLower.length > 3 && !seatMatch && !empIdMatch) {
    // Search top 15 matching employees to supply as precise context
    const searchResult = DbService.getEmployees(15, 0, queryText);
    context.matchingEmployees = searchResult.data.map(e => ({
      id: e.id,
      name: e.name,
      role: e.role,
      department: e.department,
      projectCode: e.projectCode,
      seatId: e.seatId,
      status: e.status
    }));
  }

  // Always supply global utilization statistics
  context.globalStats = DbService.getStats();
  context.projectsSummary = DbService.getProjects().map(p => ({
    code: p.code,
    name: p.name,
    lead: p.lead,
    targetZone: p.targetZone
  }));

  return context;
}

/**
 * Processes a natural language query using Gemini 3.5 Flash
 */
export async function processAssistantQuery(queryText: string): Promise<GeminiAssistantResponse> {
  const context = gatherQueryContext(queryText);
  const prompt = queryText.trim();

  // If API key is missing, provide a robust, polite, and fully-featured offline response matching the user query
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return processOfflineFallback(queryText, context);
  }

  try {
    const ai = getAiClient();
    
    const systemInstruction = `You are the AI Seating Assistant for a large enterprise workspace of 5,000 employees.
You have access to real-time seating layouts, project mappings, and employee rosters.
Current Database Status Context:
${JSON.stringify(context, null, 2)}

Your goals:
1. Answer questions about seating capacity, floor plan layouts, projects, and specific employee details.
2. Identify user intents to ALLOCATE, RELEASE, or MOVE employees.
3. If the user wants to allocate a seat, you must identify:
   - "employeeId" (e.g., EMP-0102)
   - "seatId" (e.g., F1-ZA-045)
4. If the user wants to release a seat, you must identify:
   - "employeeId" (e.g., EMP-0102)
5. Keep your responses highly helpful, brief, and beautifully formatted in markdown.
6. Provide exactly 3 short, relevant follow-up query suggestions.

You MUST respond ONLY with a JSON object of this schema:
{
  "answer": "Your detailed answer or actions-taken statement in friendly markdown...",
  "intent": "ALLOCATE" | "RELEASE" | "QUERY",
  "targetEmployeeId": "EMP-XXXX" or null,
  "targetSeatId": "F1-ZX-XXX" or null,
  "suggestions": ["suggested query 1", "suggested query 2", "suggested query 3"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            intent: { type: Type.STRING, enum: ['ALLOCATE', 'RELEASE', 'QUERY'] },
            targetEmployeeId: { type: Type.STRING, nullable: true },
            targetSeatId: { type: Type.STRING, nullable: true },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['answer', 'intent', 'suggestions']
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    let actionExecuted: string | null = null;
    let updatedEmployee: any = undefined;

    // Execute mutations if Gemini identified the intent
    if (parsed.intent === 'ALLOCATE' && parsed.targetEmployeeId && parsed.targetSeatId) {
      const result = DbService.allocateSeat(parsed.targetEmployeeId, parsed.targetSeatId);
      if (result.success) {
        actionExecuted = `Allocated seat ${parsed.targetSeatId} to employee ${parsed.targetEmployeeId}`;
        updatedEmployee = result.employee;
        parsed.answer = `### 🏢 Seat Allocation Completed Successfully!\n\nI have allocated **seat ${parsed.targetSeatId}** to **${result.employee?.name}** (${parsed.targetEmployeeId}).\n\n* **Project Assignment**: \`${result.employee?.projectCode || 'None'}\`\n* **Status**: Seated on Floor ${parsed.targetSeatId.split('-')[0].substring(1)}, Zone ${parsed.targetSeatId.split('-')[1].substring(1)}\n\n${parsed.answer}`;
      } else {
        parsed.answer = `### ⚠️ Seating Allocation Failed\n\nI attempted to allocate **seat ${parsed.targetSeatId}** to employee **${parsed.targetEmployeeId}**, but encountered an issue: *${result.message}*`;
      }
    } else if (parsed.intent === 'RELEASE' && parsed.targetEmployeeId) {
      const targetEmp = DbService.getEmployeeById(parsed.targetEmployeeId);
      const prevSeat = targetEmp?.seatId;
      const result = DbService.releaseSeat(parsed.targetEmployeeId);
      if (result.success && prevSeat) {
        actionExecuted = `Released seat ${prevSeat} from employee ${parsed.targetEmployeeId}`;
        updatedEmployee = result.employee;
        parsed.answer = `### 🔓 Seat Released Successfully!\n\nI have successfully released **seat ${prevSeat}** which was occupied by **${result.employee?.name}** (${parsed.targetEmployeeId}).\n\n* **Current Status**: Unassigned / Hot-desking\n\n${parsed.answer}`;
      } else {
        parsed.answer = `### ⚠️ Seat Release Failed\n\nI was unable to release the seat for employee **${parsed.targetEmployeeId}**. *${result.message}*`;
      }
    }

    return {
      answer: parsed.answer,
      actionExecuted,
      updatedEmployee,
      suggestions: parsed.suggestions || ['Find vacant seats on floor 1', 'List unassigned new joiners', 'Who sits at F2-ZA-005?']
    };

  } catch (error) {
    console.error('Gemini API call failed, reverting to local assistant rules:', error);
    return processOfflineFallback(queryText, context);
  }
}

/**
 * Super robust local fallback rule-engine that handles queries immediately
 * when the API key is not present or calls fail. Keeps the system fully offline-autonomous!
 */
function processOfflineFallback(queryText: string, context: any): GeminiAssistantResponse {
  const queryLower = queryText.toLowerCase().trim();
  let answer = '';
  let actionExecuted: string | null = null;
  let updatedEmployee: any = undefined;
  let suggestions = [
    'Find vacant seats on floor 2',
    'Show me unassigned new joiners',
    'Who sits at F1-ZA-001?'
  ];

  // 1. Check for specific Seat query
  const seatMatch = queryLower.match(/f[1-4]-z[a-d]-\d{3}/);
  if (seatMatch) {
    const seatId = seatMatch[0].toUpperCase();
    const employee = DbService.getEmployeeBySeat(seatId);
    if (employee) {
      answer = `### 📍 Seat Registry: ${seatId}\n\nThis seat is currently **Occupied**.\n\n* **Employee**: **${employee.name}** (\`${employee.id}\`)\n* **Role**: ${employee.role}\n* **Department**: ${employee.department}\n* **Assigned Project**: \`${employee.projectCode || 'None'}\`\n* **Employment Status**: ${employee.status}`;
    } else {
      answer = `### 🟢 Seat Registry: ${seatId}\n\nThis seat is currently **Vacant** and available for immediate allocation.`;
    }
    suggestions = [
      `Allocate ${seatId} to a new joiner`,
      `Who sits near ${seatId}?`,
      `Show me vacant seats on Floor ${seatId.charAt(1)}`
    ];
    return { answer, actionExecuted, suggestions };
  }

  // 2. Check for Employee query
  const empIdMatch = queryLower.match(/emp-\d{4}/);
  if (empIdMatch) {
    const empId = empIdMatch[0].toUpperCase();
    const employee = DbService.getEmployeeById(empId);
    if (employee) {
      answer = `### 👤 Employee Profile: ${employee.name}\n\n* **ID**: \`${employee.id}\`\n* **Role**: ${employee.role}\n* **Department**: ${employee.department}\n* **Project Mapping**: \`${employee.projectCode || 'None'}\`\n* **Seat Assignment**: ${employee.seatId ? `**${employee.seatId}**` : '❌ **Unassigned (Needs Desk)**'}\n* **Status**: ${employee.status}\n* **Join Date**: ${employee.joinDate}`;
    } else {
      answer = `### ⚠️ Profile Not Found\n\nI searched our corporate directory but could not find any active employee with ID **${empId}**.`;
    }
    return { answer, actionExecuted, suggestions };
  }

  // 3. Check for general search keywords
  if (queryLower.includes('new joiner') || queryLower.includes('unassigned') || queryLower.includes('no seat')) {
    const unassigned = DbService.getEmployees(5, 0, '', '', null, '', true);
    answer = `### 📋 Unassigned New Joiner Queue\n\nThere are currently **${context.globalStats.unassignedJoiners} new joiners** without a permanent desk assignment. Here are the top pending profiles:\n\n`;
    unassigned.data.forEach(e => {
      answer += `- **${e.name}** (\`${e.id}\`) - ${e.role} (${e.department}) - Joined: *${e.joinDate}*\n`;
    });
    answer += `\n*You can auto-allocate these joiners instantly by typing "auto allocate new joiners" or clicking the Auto-Allocate button on the queue panel.*`;
    suggestions = [
      'Auto allocate all new joiners',
      'Show stats for project Apollo',
      'Find vacant seats on floor 4'
    ];
    return { answer, actionExecuted, suggestions };
  }

  // 4. Seating stats query
  if (queryLower.includes('utilization') || queryLower.includes('occupancy') || queryLower.includes('stats') || queryLower.includes('capacity')) {
    const s = context.globalStats;
    answer = `### 📊 Enterprise Seating Utilization Report\n\nHere is the real-time capacity dashboard for our office workspace:\n\n* **Total Physical Desks**: **${s.totalSeats}**\n* **Occupied Desks**: **${s.occupiedSeats}** (${s.utilizationRate}% occupancy rate)\n* **Available Desks**: **${s.vacantSeats}**\n* **Total Roster Count**: **${s.totalEmployees}** employees\n* **Pending Workspace Allocations**: **${s.unassignedJoiners}** new joiners\n\nMost project groups are seated within their designated zones to encourage rapid collaboration.`;
    suggestions = [
      'Which project has highest utilization?',
      'Show seating for Project Gemini',
      'Find vacant seats on floor 3'
    ];
    return { answer, actionExecuted, suggestions };
  }

  // 5. Seating allocation requests offline parsing (e.g., "allocate seat F1-ZA-005 to EMP-0012")
  const allocateMatch = queryLower.match(/allocate\s+(?:seat\s+)?(f[1-4]-z[a-d]-\d{3})\s+(?:to\s+)?(?:employee\s+)?(emp-\d{4})/);
  if (allocateMatch) {
    const seatId = allocateMatch[1].toUpperCase();
    const empId = allocateMatch[2].toUpperCase();
    const result = DbService.allocateSeat(empId, seatId);
    if (result.success) {
      actionExecuted = `Allocated seat ${seatId} to employee ${empId}`;
      updatedEmployee = result.employee;
      answer = `### 🏢 Seat Allocation Successful! (Offline Rule Engine)\n\nI have allocated **seat ${seatId}** to **${result.employee?.name}** (${empId}).\n\nAll floor plans and team analytics have been updated successfully!`;
    } else {
      answer = `### ⚠️ Seat Allocation Failed\n\nCould not allocate **seat ${seatId}** to **${empId}**:\n*${result.message}*`;
    }
    return { answer, actionExecuted, updatedEmployee, suggestions };
  }

  // 6. Release desk offline parsing
  const releaseMatch = queryLower.match(/(?:release|free|vacate)\s+(?:seat\s+for\s+)?(?:employee\s+)?(emp-\d{4})/);
  if (releaseMatch) {
    const empId = releaseMatch[1].toUpperCase();
    const emp = DbService.getEmployeeById(empId);
    const prevSeat = emp?.seatId;
    const result = DbService.releaseSeat(empId);
    if (result.success && prevSeat) {
      actionExecuted = `Released seat ${prevSeat} from employee ${empId}`;
      updatedEmployee = result.employee;
      answer = `### 🔓 Seat Released Successfully! (Offline Rule Engine)\n\nI have released **seat ${prevSeat}** which was occupied by **${result.employee?.name}** (${empId}).\n\nThis desk is now vacant and ready for new assignments.`;
    } else {
      answer = `### ⚠️ Release Seat Failed\n\nCould not release seat for employee **${empId}**: *${result.message}*`;
    }
    return { answer, actionExecuted, updatedEmployee, suggestions };
  }

  // 7. Auto allocate command
  if (queryLower.includes('auto allocate') || queryLower.includes('auto-allocate')) {
    const res = DbService.autoAllocateJoiners();
    actionExecuted = `Auto-allocated ${res.allocatedCount} new joiners`;
    answer = `### ⚡ Auto-Allocation Complete!\n\nI scanned all floors and processed **${res.allocatedCount} new joiners**:\n\n`;
    res.details.forEach(d => {
      answer += `- ${d}\n`;
    });
    return { answer, actionExecuted, suggestions };
  }

  // 8. General search default fallback
  if (context.matchingEmployees && context.matchingEmployees.length > 0) {
    answer = `### 🔍 Roster Search Results\n\nI found the following employees matching your query:\n\n`;
    context.matchingEmployees.forEach((e: any) => {
      answer += `- **${e.name}** (\`${e.id}\`) - ${e.role} [${e.department}] -> Seated at **${e.seatId || '❌ Unassigned'}**\n`;
    });
    suggestions = [
      `Who sits at ${context.matchingEmployees[0].seatId || 'F1-ZA-001'}?`,
      'Show unassigned new joiners',
      'List all projects'
    ];
  } else {
    answer = `### 👋 Welcome to AI Seating Assistant\n\nI can help you find employees, map desks, manage project zoning, and perform seat allocations instantly.\n\n**Here are a few things you can ask me:**\n\n* "Who is sitting at F2-ZA-012?"\n* "Find seat for David Vance"\n* "Show unassigned new joiners"\n* "Allocate seat F1-ZA-102 to EMP-0015"\n* "What is our current seat utilization?"\n\n*Enter a query or command above to begin.*`;
  }

  return { answer, actionExecuted, suggestions };
}
