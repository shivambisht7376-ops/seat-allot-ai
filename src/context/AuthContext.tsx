/**
 * AuthContext — provides user session, JWT token, login/logout.
 * Token is persisted in localStorage under "saa_token".
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id:           string;
  employeeCode: string;
  name:         string;
  email:        string;
  role:         'ADMIN' | 'MANAGER' | 'EMPLOYEE';
}

interface AuthContextValue {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout:  () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'saa_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      // Decode JWT payload (no verify – server verifies on every request)
      try {
        const payload = JSON.parse(atob(saved.split('.')[1]));
        // Check not expired
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          setToken(saved);
          setUser({
            id:           payload.userId,
            employeeCode: payload.employeeCode,
            name:         payload.name,
            email:        '',   // not in JWT payload, fetch if needed
            role:         payload.role as AuthUser['role'],
          });
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Login failed.' };

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser({
        id:           data.user.id,
        employeeCode: data.user.id,
        name:         data.user.name,
        email:        data.user.email,
        role:         data.user.role as AuthUser['role'],
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Could not reach server.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience hook: returns Authorization header object for fetch calls */
export function useAuthHeader(): { Authorization: string } | {} {
  const { token } = useAuth();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
