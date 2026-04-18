import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  applyThemePrimaryColor,
  getNextTheme,
  readInitialTheme,
  resolveThemePrimaryColor,
  THEME_STORAGE_KEY,
} from './theme';

const resetThemeRoot = () => {
  document.documentElement.className = '';
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
  document.documentElement.style.removeProperty('--primary');
  document.documentElement.style.removeProperty('--ring');
  document.documentElement.style.removeProperty('--sidebar-primary');
  window.localStorage.clear();
};

describe('theme utilities', () => {
  beforeEach(() => {
    resetThemeRoot();
  });

  it('reads the already-applied document theme before local storage', () => {
    document.documentElement.dataset.theme = 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(readInitialTheme()).toBe('light');
  });

  it('applies theme metadata to the document root', () => {
    applyTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('returns the opposite theme when toggling', () => {
    expect(getNextTheme('light')).toBe('dark');
    expect(getNextTheme('dark')).toBe('light');
  });

  it('maps the black accent to a visible dark-mode primary color', () => {
    expect(resolveThemePrimaryColor('#000000', 'dark')).toBe('0 0% 100%');
  });

  it('does not override theme defaults when there is no accent color', () => {
    applyThemePrimaryColor(null, 'dark');

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ring')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--sidebar-primary')).toBe('');
  });

  it('applies the resolved accent color to all primary theme variables', () => {
    const primaryColor = resolveThemePrimaryColor('#3B82F6', 'light');

    applyThemePrimaryColor('#3B82F6', 'light');

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(primaryColor);
    expect(document.documentElement.style.getPropertyValue('--ring')).toBe(primaryColor);
    expect(document.documentElement.style.getPropertyValue('--sidebar-primary')).toBe(primaryColor);
  });
});
