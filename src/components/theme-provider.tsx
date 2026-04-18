import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ThemeContext,
  type ThemeContextValue,
  type AppTheme,
  THEME_STORAGE_KEY,
  normalizeTheme,
  persistTheme,
  applyTheme,
  getNextTheme,
  readAppliedTheme,
  readInitialTheme,
  withThemeTransitionsSuppressed,
} from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readInitialTheme);

  useLayoutEffect(() => {
    const syncTheme = () => {
      applyTheme(theme);
      persistTheme(theme);
    };

    if (readAppliedTheme() === theme) {
      persistTheme(theme);
      return;
    }

    withThemeTransitionsSuppressed(syncTheme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = normalizeTheme(event.newValue);
      setThemeState((currentTheme) => currentTheme === nextTheme ? currentTheme : nextTheme);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState((currentTheme) => currentTheme === nextTheme ? currentTheme : nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => getNextTheme(currentTheme));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
