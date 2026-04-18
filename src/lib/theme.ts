import { createContext } from 'react';

export type AppTheme = 'light' | 'dark';

export type ThemeContextValue = {
  theme: AppTheme;
  resolvedTheme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = 'docmoc-theme';
export const DEFAULT_THEME: AppTheme = 'light';

const THEME_DARK_CLASS = 'dark';
const THEME_TRANSITION_STYLE_ATTRIBUTE = 'data-docmoc-theme-transition';
const LIGHT_PRIMARY_HSL = '0 0% 100%';
const BLACK_HEX = '#000000';
const PRIMARY_COLOR_VARIABLES = ['--primary', '--ring', '--sidebar-primary'] as const;

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const normalizeTheme = (value: string | null | undefined): AppTheme =>
  value === THEME_DARK_CLASS ? THEME_DARK_CLASS : DEFAULT_THEME;

export const getNextTheme = (theme: AppTheme): AppTheme =>
  theme === THEME_DARK_CLASS ? DEFAULT_THEME : THEME_DARK_CLASS;

export const readAppliedTheme = (): AppTheme | null => {
  if (typeof document === 'undefined') return null;
  const rootTheme = document.documentElement.dataset.theme;
  return rootTheme === DEFAULT_THEME || rootTheme === THEME_DARK_CLASS ? rootTheme : null;
};

export const applyTheme = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle(THEME_DARK_CLASS, theme === THEME_DARK_CLASS);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export const persistTheme = (theme: AppTheme) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const withThemeTransitionsSuppressed = (callback: () => void) => {
  if (typeof document === 'undefined') {
    callback();
    return;
  }

  document.head.querySelector(`[${THEME_TRANSITION_STYLE_ATTRIBUTE}]`)?.remove();
  const style = document.createElement('style');
  style.setAttribute(THEME_TRANSITION_STYLE_ATTRIBUTE, 'true');
  style.appendChild(document.createTextNode(`
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }
  `));
  document.head.appendChild(style);

  void window.getComputedStyle(document.body ?? document.documentElement).opacity;
  callback();

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      style.remove();
    });
  });
};

export const readInitialTheme = (): AppTheme => {
  const appliedTheme = readAppliedTheme();
  if (appliedTheme) return appliedTheme;

  if (typeof window === 'undefined') return DEFAULT_THEME;
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
};

const hexToHsl = (hex: string) => {
  const normalizedHex = hex.replace('#', '');
  if (normalizedHex.length !== 6) return null;

  const red = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const green = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const blue = parseInt(normalizedHex.substring(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6;
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
        break;
    }

    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

export const resolveThemePrimaryColor = (accentColor: string | null | undefined, theme: AppTheme) => {
  const normalizedAccent = accentColor?.toLowerCase() || null;
  if (!normalizedAccent) return null;
  if (normalizedAccent === BLACK_HEX && theme === THEME_DARK_CLASS) {
    return LIGHT_PRIMARY_HSL;
  }

  return hexToHsl(normalizedAccent);
};

export const applyThemePrimaryColor = (accentColor: string | null | undefined, theme: AppTheme) => {
  if (typeof document === 'undefined') return;

  const primaryColor = resolveThemePrimaryColor(accentColor, theme);
  const root = document.documentElement;
  PRIMARY_COLOR_VARIABLES.forEach((variableName) => {
    if (primaryColor) {
      root.style.setProperty(variableName, primaryColor);
      return;
    }

    root.style.removeProperty(variableName);
  });
};
