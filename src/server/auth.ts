/**
 * JWT Authentication middleware and login endpoint handler.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';
const JWT_EXPIRES_IN = '8h';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  employeeCode: string;
  name: string;
}

// ── Extend Express Request to carry decoded JWT payload ──
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Returns: { token, user: { id, name, email, role, employeeCode } }
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required.' });
    return;
  }

  try {
    // Find the user (across all tenants – email is unique per tenant, so grab first match)
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { tenant: { select: { id: true, slug: true } } },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      employeeCode: user.employeeCode,
      name: user.name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: {
        id: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantSlug: user.tenant.slug,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
}

/**
 * Express middleware: validates Bearer JWT token on protected routes.
 * Attaches decoded payload to req.user.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authorization token required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware factory: only allows requests from users with one of the given roles.
 * Must be used AFTER authenticateToken.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
      return;
    }
    next();
  };
}

/**
 * GET /api/auth/me — returns the current user profile from the JWT.
 */
export function meHandler(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  res.json({
    id:           req.user.userId,
    employeeCode: req.user.employeeCode,
    name:         req.user.name,
    role:         req.user.role,
    tenantId:     req.user.tenantId,
  });
}

/**
 * Utility: hash a plain-text password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
