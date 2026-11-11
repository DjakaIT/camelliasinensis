import type { NextConfig } from 'next';

// Statični export (FRONTEND-ODLUKA §6): bez API ruta, Server Actions, middlewarea, ISR-a i dynamicParams.
const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'demo';
if (!['demo', 'devserver', 'hosting'].includes(backend)) {
  throw new Error(`NEXT_PUBLIC_BACKEND mora biti "demo", "devserver" ili "hosting", a ne "${backend}"`);
}

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Datoteke *.demo.tsx (stranica za plaćanje demo backenda /blagajna/) postoje samo u demo buildu.
  pageExtensions: backend === 'demo' ? ['tsx', 'ts', 'demo.tsx'] : ['tsx', 'ts'],
  env: { NEXT_PUBLIC_BACKEND: backend },
  // CSS ugrađen u HTML: nema render-blocking zahtjeva (Lighthouse, GUIDE §4.6).
  experimental: { inlineCss: true },
};

export default config;
