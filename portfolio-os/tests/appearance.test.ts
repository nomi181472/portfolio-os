/**
 * tests/appearance.test.ts
 *
 * Tests verifying root appearance state management, resolver logic,
 * token definitions, and synchronized theme switching contracts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  APPEARANCES,
  APPEARANCE_CHOICES,
  APPEARANCE_META,
  configuredAppearance,
  isAppearanceChoice,
  resolveAppearance,
  THEME_COLORS,
} from '../lib/theme';

test('resolveAppearance resolves explicit palettes and system OS media queries correctly', () => {
  // Explicit choices always resolve directly to themselves
  assert.equal(resolveAppearance('light'), 'light');
  assert.equal(resolveAppearance('dark'), 'dark');
  assert.equal(resolveAppearance('contrast'), 'contrast');
  assert.equal(resolveAppearance('sepia'), 'sepia');

  // 'system' follows OS media queries
  assert.equal(resolveAppearance('system', true, false), 'dark');
  assert.equal(resolveAppearance('system', false, false), 'light');
  assert.equal(resolveAppearance('system', true, true), 'contrast');
  assert.equal(resolveAppearance('system', false, true), 'contrast');

  // Null/undefined defaults to OS media queries
  assert.equal(resolveAppearance(null, true), 'dark');
  assert.equal(resolveAppearance(undefined, false), 'light');
});

test('configuredAppearance ensures safe server rendering without undefined tokens', () => {
  assert.equal(configuredAppearance('light'), 'light');
  assert.equal(configuredAppearance('sepia'), 'sepia');
  assert.equal(configuredAppearance('contrast'), 'contrast');
  assert.equal(configuredAppearance('dark'), 'dark');
  assert.equal(configuredAppearance('system'), 'dark');
  assert.equal(configuredAppearance(null), 'dark');
  assert.equal(configuredAppearance('invalid'), 'dark');
});

test('isAppearanceChoice validates valid choices and rejects arbitrary strings', () => {
  for (const choice of APPEARANCE_CHOICES) {
    assert.ok(isAppearanceChoice(choice), `must accept choice: ${choice}`);
  }
  assert.ok(!isAppearanceChoice('blue'));
  assert.ok(!isAppearanceChoice(null));
  assert.ok(!isAppearanceChoice(undefined));
  assert.ok(!isAppearanceChoice(123));
});

test('THEME_COLORS maps every concrete appearance to a valid hex color', () => {
  for (const appearance of APPEARANCES) {
    const color = THEME_COLORS[appearance];
    assert.ok(color, `THEME_COLORS must define color for: ${appearance}`);
    assert.match(color, /^#[0-9a-fA-F]{6}$/);
    assert.equal(color, APPEARANCE_META[appearance].themeColor);
  }
});

test('tokens.css contains explicit [data-appearance] definitions and semantic aliases', () => {
  const tokensCss = readFileSync(
    resolve(process.cwd(), 'styles/tokens.css'),
    'utf8',
  );

  assert.match(tokensCss, /\[data-appearance='dark'\]/, 'tokens.css must support [data-appearance="dark"]');
  assert.match(tokensCss, /\[data-appearance='light'\]/, 'tokens.css must support [data-appearance="light"]');
  assert.match(tokensCss, /\[data-appearance='contrast'\]/, 'tokens.css must support [data-appearance="contrast"]');
  assert.match(tokensCss, /\[data-appearance='sepia'\]/, 'tokens.css must support [data-appearance="sepia"]');

  // Semantic aliases for consistency across components
  assert.match(tokensCss, /--ink-secondary:\s*var\(--ink-quiet\)/, 'must alias --ink-secondary');
  assert.match(tokensCss, /--accent:\s*var\(--signal\)/, 'must alias --accent');
  assert.match(tokensCss, /--rule-subtle:\s*var\(--rule\)/, 'must alias --rule-subtle');
  assert.match(tokensCss, /--primary:\s*var\(--signal\)/, 'must alias --primary');
  assert.match(tokensCss, /--canvas:\s*var\(--surface\)/, 'must alias --canvas');
});

test('ThemeToggle and layout components consume root AppearanceProvider', () => {
  const toggleSource = readFileSync(
    resolve(process.cwd(), 'components/theme/ThemeToggle.tsx'),
    'utf8',
  );
  assert.match(toggleSource, /useAppearance\(\)/, 'ThemeToggle must consume useAppearance()');

  const layoutSource = readFileSync(
    resolve(process.cwd(), 'app/layout.tsx'),
    'utf8',
  );
  assert.match(layoutSource, /<AppearanceProvider/, 'RootLayout must mount AppearanceProvider at the root');

  const shellSource = readFileSync(
    resolve(process.cwd(), 'components/layout/Shell.tsx'),
    'utf8',
  );
  assert.match(shellSource, /useAppearance\(\)/, 'Shell must consume useAppearance()');
  assert.match(shellSource, /data-appearance=\{activeAppearance\}/, 'Shell must stamp data-appearance');
});
