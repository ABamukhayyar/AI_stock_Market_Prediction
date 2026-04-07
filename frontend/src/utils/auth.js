export const AUTH_STORAGE_KEY = 'user';

export function getStoredUser() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getStoredUser());
}

export function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function createDemoUser(overrides = {}) {
  return {
    id: 'demo-user',
    fullName: 'Ahmed Al-Rashidi',
    email: 'ahmed@example.com',
    ...overrides,
  };
}
