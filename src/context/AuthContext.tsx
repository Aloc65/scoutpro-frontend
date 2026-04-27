import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, removeToken, getToken } from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  changePassword: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const normalizeUser = (incomingUser: User | null | undefined): User | null => {
  if (!incomingUser) return null;

  const normalizedRole = (incomingUser.role || '').toString().trim().toUpperCase();
  const role = normalizedRole === 'ADMIN' ? 'ADMIN' : 'SCOUT';

  return {
    ...incomingUser,
    role,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      const data = await api.get<{ user: User }>('/api/auth/me');
      const normalizedUser = normalizeUser(data.user);
      console.log('[AuthContext] /api/auth/me user:', normalizedUser);
      setUser(normalizedUser);
    } catch {
      await removeToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    await setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/auth/login user:', normalizedUser);
    setUser(normalizedUser);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/api/signup', { name, email, password });
    await setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/signup user:', normalizedUser);
    setUser(normalizedUser);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const data = await api.put<{ token: string; user: User }>('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
    await setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/auth/change-password user:', normalizedUser);
    setUser(normalizedUser);
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
