const DEFAULT_API_BASE = 'http://127.0.0.1:3030';

export function resolveApiBase(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE;
  }

  const apiBase = new URLSearchParams(window.location.search).get('apiBase')?.trim() ?? '';
  if (!apiBase) {
    return DEFAULT_API_BASE;
  }

  return apiBase.replace(/\/+$/, '');
}

