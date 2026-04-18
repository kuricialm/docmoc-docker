import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/lib/api';
import { getFaviconMimeType } from '@/lib/favicon';
import { applyThemePrimaryColor } from '@/lib/theme';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  accent_color: string | null;
  avatar_url: string | null;
  workspace_logo_url: string | null;
};

type AuthContextType = {
  user: { id: string; email: string; uploadQuotaBytes: number | null } | null;
  session: boolean;
  loading: boolean;
  settingsLoading: boolean;
  isAdmin: boolean;
  profile: Profile | null;
  appSettings: api.AppSettings;
  signOut: () => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: false,
  loading: true,
  settingsLoading: true,
  isAdmin: false,
  profile: null,
  appSettings: api.DEFAULT_APP_SETTINGS,
  signOut: () => {},
  signIn: async () => {},
  refreshProfile: async () => {},
  refreshSettings: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function userToProfile(u: api.User): Profile {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    accent_color: u.accentColor,
    avatar_url: u.avatarUrl,
    workspace_logo_url: u.workspaceLogoUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isPublicSharedRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/shared/');
  const [currentUser, setCurrentUser] = useState<api.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appSettings, setAppSettings] = useState<api.AppSettings>(api.DEFAULT_APP_SETTINGS);

  useEffect(() => {
    if (isPublicSharedRoute) {
      setCurrentUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    api.getCurrentUser().then((u) => {
      setCurrentUser(u);
      setProfile(u ? userToProfile(u) : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isPublicSharedRoute]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setAppSettings(s);
    } catch {
      setAppSettings(api.DEFAULT_APP_SETTINGS);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    const u = await api.login(email, password, rememberMe);
    setCurrentUser(u);
    setProfile(userToProfile(u));
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setCurrentUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!currentUser) return;
    const u = await api.getProfile();
    if (u) {
      setCurrentUser(u);
      setProfile(userToProfile(u));
    }
  }, [currentUser]);

  const user = currentUser ? { id: currentUser.id, email: currentUser.email, uploadQuotaBytes: currentUser.uploadQuotaBytes ?? null } : null;
  const isAdmin = currentUser?.role === 'admin';

  useLayoutEffect(() => {
    applyThemePrimaryColor(profile?.accent_color, resolvedTheme);
  }, [profile?.accent_color, resolvedTheme]);

  useEffect(() => {
    const href = appSettings.workspace_favicon_url || '/placeholder.svg';
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    const type = getFaviconMimeType(href);
    if (type) link.type = type;
    const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (existing) {
      existing.replaceWith(link);
      return;
    }
    document.head.appendChild(link);
  }, [appSettings.workspace_favicon_url]);

  return (
    <AuthContext.Provider value={{ user, session: !!user, loading, settingsLoading, isAdmin, profile, appSettings, signOut, signIn, refreshProfile, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
}
