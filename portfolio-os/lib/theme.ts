/**
 * lib/theme.ts
 *
 * Single source of truth for appearance. It has to be importable from three
 * places at once — the server (to render the right `data-appearance` on the first
 * byte), a blocking inline script (to correct it before paint), and a client
 * component (to change it and remember it) — so it is dependency-free, uses no
 * Node or browser globals, and its string values are the exact attribute values in
 * styles/tokens.css.
 *
 * Two storage media, and only one of them is load-bearing here. `localStorage` is
 * the preference, and the blocking script below is what reads it before paint. The
 * cookie that ThemeToggle also writes is an extension point rather than a
 * dependency: nothing in this codebase reads it, because reading a cookie in a
 * layout makes every route dynamic and this site is served as static HTML. A fork
 * that would rather render the saved palette on the server calls
 * `appearanceFromCookieValue` with `cookies()` and accepts that trade — the attribute
 * is already wired to accept it.
 */
export const APPEARANCES = ['dark', 'light', 'contrast', 'sepia'] as const;
export type Appearance = (typeof APPEARANCES)[number];

/** What the visitor may pick. `system` resolves at apply time, never at rest. */
export const APPEARANCE_CHOICES = ['system', ...APPEARANCES] as const;
export type AppearanceChoice = (typeof APPEARANCE_CHOICES)[number];

export const APPEARANCE_STORAGE_KEY = 'portfolio-os.appearance';
export const APPEARANCE_COOKIE = 'portfolio-appearance';
/** How long the cookie stays useful: a year, but it is not a session or a secret. */
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface AppearanceMeta {
  /** The label shown in the toggle. */
  label: string;
  /** What the choice does, in the toggle's own tooltip. */
  hint: string;
  /** Value for the `theme-color` browser-chrome meta. */
  themeColor: string;
}

export const APPEARANCE_META: Record<AppearanceChoice, AppearanceMeta> = {
  system: { label: 'System', hint: 'Follow this device', themeColor: '#090a0d' },
  dark: { label: 'Obsidian', hint: 'Dark, low light', themeColor: '#090a0d' },
  light: { label: 'Paper', hint: 'Light, high legibility', themeColor: '#f8fafc' },
  contrast: { label: 'High contrast', hint: 'Pure black and white', themeColor: '#000000' },
  sepia: { label: 'Sepia', hint: 'Warm, for long reading', themeColor: '#f4ece0' },
};

export function isAppearanceChoice(value: unknown): value is AppearanceChoice {
  return typeof value === 'string' && (APPEARANCE_CHOICES as readonly string[]).includes(value);
}

/**
 * The palette actually painted, given a choice and the two media queries the
 * operating system may be asserting. `system` is never returned: it is a pointer,
 * not a palette, and letting it reach the DOM is how you get unstyled elements.
 */
export function resolveAppearance(
  choice: AppearanceChoice | null | undefined,
  prefersDark = true,
  prefersMoreContrast = false,
): Appearance {
  if (choice === 'light' || choice === 'dark' || choice === 'contrast' || choice === 'sepia') return choice;
  if (prefersMoreContrast) return 'contrast';
  return prefersDark ? 'dark' : 'light';
}

/**
 * The palette the server may safely render for a configured default. Every
 * concrete palette passes through; `system` cannot be resolved without the
 * device's media queries, so it falls back to dark rather than rendering an
 * attribute the token layer does not understand.
 */
export function configuredAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'contrast' || value === 'sepia' ? value : 'dark';
}

/**
 * The script that runs in <head> before the stylesheet paints. Kept as a string
 * so it can be inlined without a hydration boundary, and written against nothing
 * but DOM primitives so a failure here cannot take the page down.
 *
 * It also stamps `data-appearance-applied`, which is what lets the
 * prefers-contrast fallback in tokens.css step aside once a real choice exists.
 *
 * `defaultChoice` is the site's configured default, used when storage holds
 * nothing (or garbage). A stored preference always wins over it; it exists so a
 * fresh visitor paints the configured palette instead of the OS one.
 */
export function appearanceScript(fallback: Appearance, defaultChoice: AppearanceChoice = 'system'): string {
  const metaQuery = 'meta[name="theme-color"]';
  const colors = JSON.stringify(THEME_COLORS);
  return (
    `(function(){\n` +
    `var choice=${JSON.stringify(defaultChoice)};\n` +
    `/*\n` +
    ` * The storage read is guarded on its own, not inside the block that applies the\n` +
    ` * palette. Safari and Firefox private modes can throw on the very first access, and\n` +
    ` * when one shared try swallowed both steps, a visitor in private mode got no palette\n` +
    ` * at all — not even the one the OS asked for. Reading the preference is optional;\n` +
    ` * painting the right colours is not.\n` +
    ` *\n` +
    ` * When storage holds nothing (or garbage), \`choice\` stays at the site's configured\n` +
    ` * default rather than resolving the OS — a visitor with no preference yet should\n` +
    ` * see the palette the site was designed around. Only an explicit stored choice\n` +
    ` * overrides it; \`system\` still follows the device at apply time, never at rest.\n` +
    ` */\n` +
    `try{\n` +
    `var stored=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');\n` +
    `if(typeof stored==='string'&&${JSON.stringify(APPEARANCE_CHOICES)}.indexOf(stored)>=0)choice=stored;\n` +
    `}catch(e){}\n` +
    `try{\n` +
    `var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;\n` +
    `var more=window.matchMedia('(prefers-contrast: more)').matches;\n` +
    `var resolved=choice==='light'||choice==='dark'||choice==='contrast'||choice==='sepia'?choice:(more?'contrast':(dark?'dark':'light'));\n` +
    `var root=document.documentElement;\n` +
    `root.setAttribute('data-appearance',resolved);\n` +
    `root.setAttribute('data-appearance-choice',choice);\n` +
    `root.setAttribute('data-appearance-applied','');\n` +
    `var meta=document.querySelector('${metaQuery}');\n` +
    `if(meta)meta.setAttribute('content',${colors}[resolved]||'${APPEARANCE_META[fallback].themeColor}');\n` +
    `}catch(e){}})();`
  );
}

const THEME_COLORS: Record<Appearance, string> = {
  dark: APPEARANCE_META.dark.themeColor,
  light: APPEARANCE_META.light.themeColor,
  contrast: APPEARANCE_META.contrast.themeColor,
  sepia: APPEARANCE_META.sepia.themeColor,
};

export { THEME_COLORS };

/**
 * The server-side half of the same rule: turn the raw cookie into a palette to
 * render, or `undefined` when nothing was chosen so the caller leaves the
 * attribute off and lets the media queries speak. Pure and synchronous so a layout
 * can call it and stay a server component.
 *
 * Not called by this codebase — see the note at the top of the file. It stays
 * because it is the supported way for a fork to make the first byte correct at the
 * cost of dynamic rendering, and `ThemeToggle` keeps writing the cookie it reads so
 * that switching it on is one call rather than a migration.
 */
export function appearanceFromCookieValue(raw: string | undefined | null): Appearance | undefined {
  if (!isAppearanceChoice(raw) || raw === 'system') return undefined;
  return raw;
}
