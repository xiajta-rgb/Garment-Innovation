import '@testing-library/jest-dom';

// Mock IndexedDB for persistence tests
const indexedDBMock = {
  open: () => ({
    onerror: null as (() => void) | null,
    onsuccess: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({ createIndex: () => {} }),
      transaction: () => ({
        objectStore: () => ({
          get: () => ({ onsuccess: null, onerror: null }),
          put: () => ({ onsuccess: null, onerror: null }),
          delete: () => ({ onsuccess: null, onerror: null }),
          getAll: () => ({ onsuccess: null, onerror: null }),
          index: () => ({
            openCursor: () => ({ onsuccess: null, onerror: null }),
          }),
        }),
      }),
      close: () => {},
    },
  }),
};

Object.defineProperty(globalThis, 'indexedDB', { value: indexedDBMock, writable: true });
