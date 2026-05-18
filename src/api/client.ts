import { Platform } from 'react-native';

// Determine backend URL based on environment
const RAILWAY_BACKEND_URL = 'https://astonishing-alignment-production.up.railway.app';

const getBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If running on Railway (production), use the Railway backend URL
    if (host.includes('railway.app') || host.includes('up.railway.app')) {
      return RAILWAY_BACKEND_URL;
    }
    // If accessed via Abacus preview URL, use the backend preview URL
    if (host.includes('preview.abacusai.app')) {
      return 'https://aa50c4e62.na105.preview.abacusai.app';
    }
    // Local development or any other web host — always use Railway backend
    return RAILWAY_BACKEND_URL;
  }
  // Native / fallback
  return RAILWAY_BACKEND_URL;
};

const BASE_URL = getBaseUrl();

const TOKEN_KEY = 'auth_token';
const INTENDED_ROUTE_KEY = 'auth_intended_route';

// Treat token as "expiring soon" if it expires within this many milliseconds.
// Currently the backend issues 7-day tokens; we still treat the last 5 minutes
// of validity as effectively expired so that long-running screens don't fire
// off API calls that will definitely 401.
const EXPIRY_LEEWAY_MS = 5 * 60 * 1000; // 5 minutes

// Use SecureStore on native, localStorage on web
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

// ─── Session expiration error ────────────────────────────────────────
// A dedicated error class so callers (AuthContext, screens) can detect
// expired-session errors without string-matching on the message.
export class SessionExpiredError extends Error {
  isSessionExpired = true;
  constructor(message = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as any).isSessionExpired === true;
}

// ─── 401 / session-expired hook ──────────────────────────────────────
// AuthContext registers a handler here so that whenever the API client
// detects an expired token (locally) or receives a 401 from the server,
// the auth state can be cleared and the user redirected to /auth/login.
type SessionExpiredHandler = () => void | Promise<void>;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  sessionExpiredHandler = handler;
}

let handlerFiring = false;
async function fireSessionExpired() {
  if (handlerFiring || !sessionExpiredHandler) return;
  handlerFiring = true;
  try {
    await sessionExpiredHandler();
  } catch (e) {
    console.warn('[api] sessionExpiredHandler threw:', e);
  } finally {
    // Allow handler to fire again on the next genuinely expired event
    setTimeout(() => {
      handlerFiring = false;
    }, 1000);
  }
}

// ─── JWT helpers ─────────────────────────────────────────────────────
// Standards-based decoder for the JWT payload. Works in both web
// (atob available) and React Native (base64 polyfill via Buffer/global).
function base64UrlDecode(input: string): string {
  // Convert base64url to base64
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '='
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  else if (pad === 1) throw new Error('Invalid base64url string');

  if (typeof atob === 'function') {
    // atob returns binary string; need to decode UTF-8
    const binary = atob(b64);
    try {
      // Best-effort UTF-8 decoding
      // eslint-disable-next-line no-restricted-globals
      return decodeURIComponent(
        Array.prototype.map
          .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
    } catch {
      return binary;
    }
  }
  // Fallback for environments without atob
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Buffer } = require('buffer');
  return Buffer.from(b64, 'base64').toString('utf8');
}

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number; // seconds since epoch
  iat?: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch (e) {
    console.warn('[api] Failed to decode JWT:', e);
    return null;
  }
}

/**
 * Returns true if the token is missing, malformed, or expired (with a
 * `leewayMs` safety window). Treating a soon-to-expire token as expired
 * prevents requests that would 401 mid-flight.
 */
export function isTokenExpired(token: string | null, leewayMs: number = EXPIRY_LEEWAY_MS): boolean {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') {
    // No exp claim — be conservative and treat as valid; the server will 401
    // and the response interceptor below will handle it.
    return false;
  }
  const expiresAtMs = payload.exp * 1000;
  return Date.now() >= expiresAtMs - leewayMs;
}

export function getTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

// ─── Token storage ───────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ─── Intended-route storage ──────────────────────────────────────────
// Save the route the user was on when they got 401'd, so we can return
// them after re-login. Kept in localStorage on web, SecureStore-free on
// native (we use AsyncStorage if available, else fall back to in-memory).
let nativeIntendedRoute: string | null = null;

export async function saveIntendedRoute(route: string | null): Promise<void> {
  try {
    if (!route) {
      await clearIntendedRoute();
      return;
    }
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(INTENDED_ROUTE_KEY, route);
      }
      return;
    }
    nativeIntendedRoute = route;
  } catch {
    // ignore
  }
}

export async function getIntendedRoute(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(INTENDED_ROUTE_KEY);
    }
    return nativeIntendedRoute;
  } catch {
    return null;
  }
}

export async function clearIntendedRoute(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(INTENDED_ROUTE_KEY);
      }
      return;
    }
    nativeIntendedRoute = null;
  } catch {
    // ignore
  }
}

// ─── Request core ────────────────────────────────────────────────────
// Endpoints that should bypass the local "is the stored token expired?"
// pre-check (login, signup don't have a token yet; /me is used to probe
// validity at startup and should be allowed to hit the server).
const AUTH_BYPASS_PATHS = ['/api/auth/login', '/api/signup', '/api/auth/signup'];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const isAuthBypass = AUTH_BYPASS_PATHS.some((p) => path.startsWith(p));

  if (token && !isAuthBypass) {
    // Local pre-flight expiry check — saves a round-trip and prevents the
    // tracking screen from briefly flashing blank while waiting for a 401.
    if (isTokenExpired(token)) {
      console.warn('[api] Token expired locally, clearing and rejecting request:', path);
      await removeToken();
      fireSessionExpired();
      throw new SessionExpiredError();
    }
    headers['Authorization'] = `Bearer ${token}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (networkErr: any) {
    // Surface network errors with a clearer message; not a session issue.
    throw new Error(networkErr?.message || 'Network error. Please check your connection.');
  }

  // 401 response interceptor — treat as expired/invalid session.
  if (res.status === 401 && !isAuthBypass) {
    await removeToken();
    fireSessionExpired();
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  // handle CSV / non-json
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/csv')) return (await res.text()) as unknown as T;
  if (res.status === 204) return {} as T;
  return res.json();
}

async function uploadFile<T>(path: string, file: any): Promise<T> {
  const token = await getToken();

  if (token && isTokenExpired(token)) {
    console.warn('[api] Token expired locally, clearing and rejecting upload:', path);
    await removeToken();
    fireSessionExpired();
    throw new SessionExpiredError();
  }

  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) {
    await removeToken();
    fireSessionExpired();
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: any) => uploadFile<T>(path, file),
  baseUrl: BASE_URL,
};
