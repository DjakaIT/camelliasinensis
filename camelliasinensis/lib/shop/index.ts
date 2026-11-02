// Jedino mjesto koje zna koji je adapter aktivan (NEXT_PUBLIC_BACKEND=demo|devserver).
import { createDemoBackend, demoControls } from './adapters/demo';
import { createDevserverBackend } from './adapters/devserver';
import type { ShopBackend } from './types';

export * from './types';
export { ShopError, shopErrorMessage, type ShopErrorCode } from './errors';

let instance: ShopBackend | null = null;

export function getShop(): ShopBackend {
  if (instance) return instance;
  const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'demo';
  if (backend === 'devserver') {
    const publicUrl = process.env.NEXT_PUBLIC_DEVSERVER_URL ?? 'http://127.0.0.1:4000';
    // Pri buildu (Node) katalog smije doći s posebnog build mocka (scripts/build-devserver.mjs).
    const buildUrl = typeof window === 'undefined' ? process.env.DEVSERVER_BUILD_URL : undefined;
    instance = createDevserverBackend(buildUrl ?? publicUrl);
  } else {
    instance = createDemoBackend();
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEMO === '1') {
      // Simulacija promjene zalihe iz konzole, "kao da ju je promijenila blagajna" (API-CONTRACT §4).
      (window as unknown as { __cs: typeof demoControls }).__cs = demoControls;
    }
  }
  return instance;
}

/**
 * Smije li se stranica indeksirati. Demo build NIKAD (START-PROMPT §4, M8); ostali samo uz NEXT_PUBLIC_INDEXABLE=1.
 * Ne govori komponenti koji je backend, samo da li je ovo javna izvedba.
 */
export const isIndexable = () =>
  (process.env.NEXT_PUBLIC_BACKEND ?? 'demo') !== 'demo' && process.env.NEXT_PUBLIC_INDEXABLE === '1';

/** Demo izvedba ima vidljivu oznaku da je riječ o probnoj trgovini. */
export const isDemoBuild = () => (process.env.NEXT_PUBLIC_BACKEND ?? 'demo') === 'demo';
