const KEY = 'carvision_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function subscribeToSessionChanges(callback: (token: string | null) => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === KEY) {
      callback(event.newValue);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
