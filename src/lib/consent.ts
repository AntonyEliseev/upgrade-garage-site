// Выбор в плашке cookie. localStorage может быть недоступен — тогда просто не запоминаем.
const KEY = 'ug-cookie';
export type Consent = 'all' | 'necessary';

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Consent) {
  try { localStorage.setItem(KEY, v); } catch { /* приватный режим */ }
}
