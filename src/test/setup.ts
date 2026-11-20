// Minimal browser globals for unit tests running in Node.
import { beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: { location: { origin: 'http://localhost:5173' } },
    configurable: true,
  });
}

beforeEach(() => storage.clear());
