const SESSION_USER_SNAPSHOT_KEY = 'soulmatch_user_snapshot';

export function readDebugModeFromLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.get('debug') === '1' || q.get('mode') === 'debug';
}

export function readDebugSkipAutoLogin(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autologin') === '0';
}

export function readDebugFastTrack(): boolean {
  if (typeof window === 'undefined') return false;
  const value = new URLSearchParams(window.location.search).get('fasttrack');
  return value !== '0';
}

export function readUserSnapshot(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_USER_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; name?: string };
    if (parsed?.id && typeof parsed.id === 'string') {
      return { id: parsed.id, name: parsed.name || '朋友' };
    }
    return null;
  } catch {
    return null;
  }
}

export function persistUserSnapshot(user: { id: string; name: string } | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    sessionStorage.removeItem(SESSION_USER_SNAPSHOT_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_USER_SNAPSHOT_KEY, JSON.stringify(user));
}
