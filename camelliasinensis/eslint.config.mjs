import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from './scripts/lib/eslint-globals.mjs';

const backendOnly = {
  paths: [
    { name: 'stripe', message: 'Stripe smije samo u mock-server/ (API-CONTRACT §6).' },
  ],
  patterns: [
    {
      group: ['**/lib/shop/adapters/*', '@/lib/shop/adapters/*', '!**/lib/shop/adapters/demo/checkout-page'],
      message: 'Komponente koriste samo @/lib/shop (sučelje ShopBackend), nikad adapter izravno.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '.next/**', 'out/**', 'out-*/**', 'node_modules/**', '.scaffold-backup/**', 'design-reference/**',
      'public/**', 'mock-server/node_modules/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts',
      'hosting/**', 'podaci/**', 'izdanja/**', 'urednistvo/sucelje/qrcode.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: { ...jsxA11y.flatConfigs.recommended.languageOptions, globals: globals.browser },
  },
  {
    files: ['app/**', 'components/**', 'lib/cart/**'],
    rules: {
      'no-restricted-imports': ['error', backendOnly],
      // Nijedna komponenta ne smije pitati koji je adapter aktivan (API-CONTRACT §4).
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='NEXT_PUBLIC_BACKEND']", message: 'Adapter bira samo lib/shop.' },
        { selector: "CallExpression[callee.name='eval']", message: 'Zabranjeno (GUIDE §5).' },
        { selector: "NewExpression[callee.name='Function']", message: 'Zabranjeno (GUIDE §5).' },
      ],
    },
  },
  {
    // Lažna stranica za plaćanje dio je demo "backenda" (API-CONTRACT §4) i postoji samo u demo buildu.
    files: ['app/blagajna/page.demo.tsx'],
    rules: { 'no-restricted-imports': ['error', { paths: backendOnly.paths }] },
  },
  {
    files: ['scripts/**/*.mjs', 'mock-server/**/*.js', 'tests/**', '*.config.*', 'playwright.config.ts', 'urednistvo/**/*.mjs', 'urednistvo/sucelje/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
