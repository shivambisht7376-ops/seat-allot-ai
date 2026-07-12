/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, AlertCircle, RefreshCw, Trash2, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthHeader } from '../context/AuthContext.js';

interface AiAssistantPanelProps {
  id: string;
  onStatsChanged: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isAction?: boolean;
  suggestions?: string[];
}

export function AiAssistantPanel({ id, onStatsChanged }: AiAssistantPanelProps) {
  const authHeader = useAuthHeader();
  const [query, setQuery] = useState<string>('');
  const WELCOME: Message = {
    id: 'welcome',
    sender: 'assistant',
    text: `### Hello! I am your AI Workspace Assistant.

I can help you query, search, and manage our database of **3,000 employees** and **5,600 desks**.

**Examples of what you can ask me:**
* 🔍 *"Find seat for David Vance"*
* 🏢 *"Who sits at Floor 2, Zone B, Seat 015?"*
* 📊 *"What is our overall seat utilization rate?"*
* ⚡ *"Allocate seat F1-ZA-102 to employee EMP-0105"*
* 🔓 *"Release seat for employee EMP-0412"*
* 📋 *"List all employees in Project Apollo"*
* 🤖 *"Auto-allocate all unassigned new joiners"*
`,
    suggestions: [
      'Find vacant seats on floor 1',
      'Show unassigned new joiners',
      'List employees in Project Apollo',
      'What is our seat utilization?',
    ]
  };
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [loading, setLoading] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleQuerySubmit = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { id: Math.random().toString(), sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader as any) },
        body: JSON.stringify({ query: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        
        const assistantMsg: Message = {
          id: Math.random().toString(),
          sender: 'assistant',
          text: data.answer,
          isAction: data.actionExecuted !== null,
          suggestions: data.suggestions || []
        };

        setMessages(prev => [...prev, assistantMsg]);

        // If Gemini executed a database state change, trigger real-time updates on frontend
        if (data.actionExecuted) {
          onStatsChanged();
        }
      } else {
        const err = await res.json();
        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'assistant',
            text: `⚠️ **Error communicating with AI service**: ${err.error || 'Server error'}`
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `⚠️ **Connection failure**: Could not connect to full-stack backend.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id={id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs h-[500px] flex flex-col justify-between">
      
      {/* Header */}
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500 rounded-lg text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold font-sans">AI Workspace Assistant</h4>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-300 font-medium">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Powered by Gemini Flash</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">ONLINE</div>
          <button
            onClick={() => setMessages([WELCOME])}
            title="Clear chat"
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Display Pane */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs font-sans shadow-2xs border ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white border-slate-900 rounded-br-xs'
                    : msg.isAction
                    ? 'bg-blue-50 text-slate-800 border-blue-150 rounded-bl-xs'
                    : 'bg-white text-slate-800 border-slate-150 rounded-bl-xs'
                }`}
              >
                {/* Custom renderer for basic Markdown styles */}
                <div className="prose prose-sm font-sans space-y-2 leading-relaxed">
                  {msg.text.split('\n').map((line, idx) => {
                    if (line.startsWith('### ')) {
                      return <h5 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1">{line.substring(4)}</h5>;
                    }
                    if (line.startsWith('* **') || line.startsWith('- **')) {
                      // Bullet bold list
                      const clean = line.replace(/^[\*\-]\s+\*\*/, '').replace(/\*\*/g, '');
                      const parts = clean.split(':');
                      return (
                        <div key={idx} className="flex gap-1.5 ml-2">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>
                            <strong className="text-slate-900">{parts[0]}</strong>: {parts.slice(1).join(':')}
                          </span>
                        </div>
                      );
                    }
                    if (line.startsWith('* ') || line.startsWith('- ')) {
                      return (
                        <div key={idx} className="flex gap-1.5 ml-2 text-slate-600">
                          <span className="text-slate-400 font-bold">•</span>
                          <span>{line.substring(2)}</span>
                        </div>
                      );
                    }
                    return <p key={idx} className="text-slate-700">{line}</p>;
                  })}
                </div>
              </div>

              {/* Interaction Chips suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 max-w-[85%]">
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      id={`suggest-btn-${i}`}
                      onClick={() => handleQuerySubmit(s)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 rounded-full text-[10px] font-semibold transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-white border border-slate-150 rounded-xl text-blue-500">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-150 rounded-2xl px-4 py-3 flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input Tray */}
      <div className="p-3 bg-white border-t border-slate-150 flex gap-2 items-center">
        <input
          type="text"
          id="assistant-input-field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit(query)}
          placeholder="Ask AI to find a seat, allocate, or pull stats..."
          className="flex-1 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none transition-all"
        />
        <button
          id="btn-send-assistant"
          onClick={() => handleQuerySubmit(query)}
          disabled={!query.trim() || loading}
          className="p-2.5 bg-slate-900 hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl shadow-xs transition-all cursor-pointer flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
