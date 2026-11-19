const TOKEN_KEY = 'smartlib_session_token';
const CSRF_KEY = 'smartlib_csrf_token';

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null, persistLocal = false): void {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, value);
    if (persistLocal) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors inside restricted sandboxes
  }
}

let csrfToken: string | null = readStorage(CSRF_KEY);
let sessionToken: string | null = readStorage(TOKEN_KEY);

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  writeStorage(CSRF_KEY, token, false);
}

export function setAuthSession(token: string | null, csrf: string | null, rememberMe = true): void {
  sessionToken = token;
  csrfToken = csrf;
  writeStorage(TOKEN_KEY, token, rememberMe);
  writeStorage(CSRF_KEY, csrf, rememberMe);
}

export function clearAuthSession(): void {
  sessionToken = null;
  csrfToken = null;
  writeStorage(TOKEN_KEY, null);
  writeStorage(CSRF_KEY, null);
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
    clearAuthSession();
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error: string }).error)
      : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function downloadAuthorizedFile(url: string, fallbackName = 'smartlib-resource.txt'): Promise<void> {
  const headers = new Headers();
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Download failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) msg = parsed.error;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
