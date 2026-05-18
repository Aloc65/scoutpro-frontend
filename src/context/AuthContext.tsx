import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import {
  api,
  setToken,
  removeToken,
  getToken,
  isTokenExpired,
  setSessionExpiredHandler,
  saveIntendedRoute,
  getIntendedRoute,
  clearIntendedRoute,
  isSessionExpiredError,
} from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  /**
   * Set to true after the auth context has detected an expired/invalid
   * session and logged the user out. Screens can read this to show a
   * "Session expired, please log in again" message.
   */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  acceptNda: () => Promise<void>;
  /** Returns true if a token is stored AND has not expired. */
  isSessionValid: () => Promise<boolean>;
  /** Take the saved intended-route (if any) and clear it. */
  consumeIntendedRoute: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  sessionExpired: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  changePassword: async () => {},
  acceptNda: async () => {},
  isSessionValid: async () => false,
  consumeIntendedRoute: async () => null,
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

// Routes we should NOT save as intended destinations (auth + initial routes).
const SKIP_INTENDED_ROUTES = ['/', '/auth/login', '/auth/signup', '/auth/change-password', '/nda-agreement'];

function buildCurrentRoute(segments: string[]): string | null {
  if (!segments || segments.length === 0) return null;
  // expo-router's segments are path parts without query params; we use
  // window.location on web to preserve query strings (e.g. sessionId=...).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { pathname, search } = window.location;
    if (!pathname) return null;
    return pathname + (search || '');
  }
  return '/' + segments.filter(Boolean).join('/');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const router = useRouter();
  const segments = useSegments();
  // Keep the latest segments in a ref so the session-expired handler
  // (registered once) always sees the current route.
  const segmentsRef = useRef<string[]>(segments as string[]);
  useEffect(() => {
    segmentsRef.current = segments as string[];
  }, [segments]);

  const loadUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      // Fast-path: if the token is already expired locally, skip the
      // round-trip and clean up.
      if (isTokenExpired(token)) {
        console.warn('[AuthContext] Stored token is expired, clearing.');
        await removeToken();
        setUser(null);
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      const data = await api.get<{ user: User }>('/api/auth/me');
      const normalizedUser = normalizeUser(data.user);
      console.log('[AuthContext] /api/auth/me user:', normalizedUser);
      setUser(normalizedUser);
    } catch (err) {
      // If /me fails (network, 401 already handled by client, etc.) clear
      // any stored token. Don't surface a "session expired" banner on
      // initial app load if there was simply no valid token — only flag
      // it when an actually-expired session was detected.
      if (isSessionExpiredError(err)) {
        setSessionExpired(true);
      }
      await removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Register the global session-expired handler with the API client.
  useEffect(() => {
    setSessionExpiredHandler(async () => {
      console.warn('[AuthContext] Session expired — clearing auth state.');
      // Save the current route so we can return to it after re-login.
      const currentRoute = buildCurrentRoute(segmentsRef.current);
      if (currentRoute && !SKIP_INTENDED_ROUTES.some((r) => currentRoute === r || currentRoute.startsWith(r + '?'))) {
        await saveIntendedRoute(currentRoute);
      }
      await removeToken();
      setUser(null);
      setSessionExpired(true);
      // Push the user to the login screen. The RootGuard would do this
      // anyway once `user` becomes null, but doing it here makes the
      // redirect immediate even if a guard effect hasn't run yet.
      try {
        router.replace('/auth/login');
      } catch (e) {
        // router might not be ready during very early bootstrap; ignore.
        console.warn('[AuthContext] router.replace during session-expired failed:', e);
      }
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, [router]);

  const isSessionValid = useCallback(async () => {
    const token = await getToken();
    if (!token) return false;
    return !isTokenExpired(token);
  }, []);

  const consumeIntendedRoute = useCallback(async () => {
    const route = await getIntendedRoute();
    if (route) await clearIntendedRoute();
    return route;
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    await setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/auth/login user:', normalizedUser);
    setUser(normalizedUser);
    setSessionExpired(false);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/api/signup', { name, email, password });
    await setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/signup user:', normalizedUser);
    setUser(normalizedUser);
    setSessionExpired(false);
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
    setSessionExpired(false);
  };

  const acceptNda = async () => {
    const data = await api.post<{ success: boolean; user: User }>('/api/auth/accept-nda');
    const normalizedUser = normalizeUser(data.user);
    console.log('[AuthContext] /api/auth/accept-nda user:', normalizedUser);
    setUser(normalizedUser);
  };

  const logout = async () => {
    await removeToken();
    await clearIntendedRoute();
    setUser(null);
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        login,
        signup,
        logout,
        changePassword,
        acceptNda,
        isSessionValid,
        consumeIntendedRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
