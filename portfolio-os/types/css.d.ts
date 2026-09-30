/**
 * types/css.d.ts
 *
 * Next.js ships type declarations for CSS Modules (`*.module.css`) but none for
 * plain global stylesheets, because TypeScript historically skipped side-effect
 * imports. TypeScript can check them now (`noUncheckedSideEffectImports`, on by
 * default in the version the editor ships), so `app/layout.tsx` needs a
 * declaration for the global sheets and the KaTeX stylesheet it pulls in.
 */

declare module '*.css';
