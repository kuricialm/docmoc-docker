import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import * as api from '@/lib/api';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  accent_color: string | null;
  avatar_url: string | null;
  workspace_logo_url: string | null;
};

type AuthContextType = {
  user: { id: string; email: string } | null;
  session: boolean;
  loading: boolean;
  isAdmin: boolean;
  profile: Profile | null;
  signOut: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  refreshProfile: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: false,
  loading: true,
  isAdmin: false,
  profile: null,
  signOut: () => {},
  signIn: async () => {},
  refreshProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEFAULT_PRIMARY_HSL = '217 91% 60%';

const hexToHsl = (hex: string) => {
  const n = hex.replace('#', '');
  if (n.length !== 6) return null;
  const r = parseInt(n.substring(0, 2), 16) / 255;
  const g = parseInt(n.substring(2, 4), 16) / 255;
  const b = parseInt(n.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0, saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case r: hue = ((g - b) / delta) % 6; break;
      case g: hue = (b - r) / delta + 2; break;
      default: hue = (r - g) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

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
  const [currentUser, setCurrentUser] = useState<api.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.getCurrentUser().then((u) => {
      setCurrentUser(u);
      setProfile(u ? userToProfile(u) : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
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
    const u = await api.getProfile(currentUser.id);
    if (u) {
      setCurrentUser(u);
      setProfile(userToProfile(u));
    }
  }, [currentUser]);

  const user = currentUser ? { id: currentUser.id, email: currentUser.email } : null;
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const accentHsl = profile?.accent_color ? hexToHsl(profile.accent_color) : null;
    const primaryColor = accentHsl || DEFAULT_PRIMARY_HSL;
    const root = document.documentElement;
    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--ring', primaryColor);
    root.style.setProperty('--sidebar-primary', primaryColor);
  }, [profile?.accent_color]);

  return (
    <AuthContext.Provider value={{ user, session: !!user, loading, isAdmin, profile, signOut, signIn, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
