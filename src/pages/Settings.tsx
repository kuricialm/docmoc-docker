import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

const ACCENT_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];

export default function SettingsPage() {
  const { user, profile, refreshProfile, isAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    setNewEmail(user?.email ?? '');
  }, [user?.email]);

  useEffect(() => {
    if (isAdmin) {
      api.getSettings().then((s) => setRegistrationEnabled(s.registration_enabled)).catch(() => {});
    }
  }, [isAdmin]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordLoading(true);
    try {
      await api.updatePassword(user.id, newPassword);
      toast.success('Password updated');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message);
    }
    setPasswordLoading(false);
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Email is required');
      return;
    }
    if (normalizedEmail === user.email) {
      toast.message('Email is already up to date');
      return;
    }

    setEmailLoading(true);
    try {
      await api.updateEmail(user.id, normalizedEmail);
      await refreshProfile();
      toast.success('Email updated');
    } catch (err: any) {
      toast.error(err.message);
    }
    setEmailLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLogoUploading(true);
    try {
      await api.uploadLogo(user.id, file);
      refreshProfile();
      toast.success('Logo updated');
    } catch {
      toast.error('Failed to upload logo');
    }
    setLogoUploading(false);
  };

  const handleAccentChange = async (color: string) => {
    if (!user) return;
    try {
      await api.updateProfile(user.id, { accentColor: color });
      refreshProfile();
      toast.success('Accent color updated');
    } catch {
      toast.error('Failed to update accent color');
    }
  };

  const handleRegistrationToggle = async (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    try {
      await api.updateSettings({ registration_enabled: enabled });
      toast.success(enabled ? 'Registration enabled' : 'Registration disabled');
    } catch {
      toast.error('Failed to update setting');
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-lg font-semibold">Settings</h2>

      {isAdmin && (
        <section className="bg-card border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold">Access Control</h3>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Allow new user registration</p>
              <p className="text-xs text-muted-foreground">When disabled, only admins can create users from the Admin page.</p>
            </div>
            <Switch checked={registrationEnabled} onCheckedChange={handleRegistrationToggle} aria-label="Toggle registration" />
          </div>
        </section>
      )}

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Change Email</h3>
        <form onSubmit={handleEmailChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New Email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" required className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={emailLoading}>
            {emailLoading ? 'Updating...' : 'Update Email'}
          </Button>
        </form>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Change Password</h3>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required minLength={6} className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={passwordLoading}>
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Workspace Logo</h3>
        <div className="flex items-center gap-4">
          {profile?.workspace_logo_url ? (
            <img src={profile.workspace_logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-cover border" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">No logo</div>
          )}
          <div>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" />
            <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()} disabled={logoUploading}>
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Appearance</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs text-muted-foreground">Use a darker color palette across the app.</p>
          </div>
          <Switch checked={resolvedTheme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
        </div>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Accent Color</h3>
        <div className="flex gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleAccentChange(c)}
              className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
              style={{ backgroundColor: c, borderColor: profile?.accent_color === c ? 'hsl(var(--foreground))' : 'transparent' }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
