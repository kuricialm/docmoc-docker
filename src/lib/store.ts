import { get, set, del, keys } from 'idb-keyval';

// ---- localStorage helpers ----
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export { load, save, get as idbGet, set as idbSet, del as idbDel, keys as idbKeys };
