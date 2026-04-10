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
    // Local development
    return 'http://localhost:3000';
  }
  // Native / fallback
  return RAILWAY_BACKEND_URL;
};

const BASE_URL = getBaseUrl();

const TOKEN_KEY = 'auth_token';

// Use SecureStore on native, localStorage on web
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

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
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
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
