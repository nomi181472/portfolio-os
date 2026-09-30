/**
 * components/theme/AppearanceScript.tsx
 *
 * A blocking inline script in <head>, which is the only reliable way to apply a
 * saved palette before the first paint. Anything deferred — a useEffect, a client
 * component, a CSS media query alone — paints the default theme first and then
 * flashes the chosen one, which on the sepia and paper palettes is a white
 * flash on a page someone left open for reading.
 *
 * The page is rendered statically, so the server does not know this device's
 * choice and <html> carries only the configured default. That is exactly the case
 * this script exists for: it reads the preference stored on the device and applies
 * it, and it keeps a `system` choice following the OS when it flips at dusk. The
 * cost of not running it is a one-frame flash of the wrong palette, which on the
 * sepia and paper palettes is a white flash on a page someone left open to read.
 */
import { appearanceScript, type Appearance, type AppearanceChoice } from '@/lib/theme';

export function AppearanceScript({ fallback, defaultChoice = 'system' }: { fallback: Appearance; defaultChoice?: AppearanceChoice }) {
  return (
    <script
      // Must run before the stylesheet takes effect, so it is explicitly blocking.
      // next/script's afterInteractive would cause the flash this exists to avoid.
      dangerouslySetInnerHTML={{ __html: appearanceScript(fallback, defaultChoice) }}
    />
  );
}
