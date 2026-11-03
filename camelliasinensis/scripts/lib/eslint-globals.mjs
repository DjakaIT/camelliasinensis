// Minimalni popis globala za ESLint (umjesto dodatnog paketa `globals`).
const ro = (names) => Object.fromEntries(names.map((n) => [n, 'readonly']));

const shared = [
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'structuredClone',
  'URL', 'URLSearchParams', 'fetch', 'Request', 'Response', 'Headers', 'AbortController', 'AbortSignal',
  'TextEncoder', 'TextDecoder', 'crypto', 'globalThis', 'FormData', 'Blob', 'Event', 'EventTarget',
];

export default {
  browser: ro([
    ...shared, 'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
    'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'matchMedia', 'HTMLElement',
    'HTMLInputElement', 'HTMLButtonElement', 'HTMLDivElement', 'KeyboardEvent', 'MouseEvent', 'StorageEvent',
    'CustomEvent', 'scrollTo', 'addEventListener', 'removeEventListener', 'getComputedStyle',
    'Node', 'confirm', 'createImageBitmap', 'Blob', 'HTMLElement',
  ]),
  node: ro([...shared, 'process', 'Buffer', '__dirname', '__filename', 'module', 'require']),
};
