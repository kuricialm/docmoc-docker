import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ImageOff } from 'lucide-react';

const ACCENT_COLORS = ['#000000', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];
const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`bg-background border border-border rounded-xl p-5 sm:p-6 space-y-4 hover:border-border/80 transition-colors duration-150 ${className}`}>
    {children}
  </section>
);

export default function SettingsPage() {
  const { user, profile, refreshProfile, isAdmin, signOut, appSettings, refreshSettings } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => { setNewEmail(user?.email ?? ''); }, [user?.email]);

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
      toast.success('Password updated. Please sign in again.');
      setNewPassword('');
      // Clear session after password change
      setTimeout(() => signOut(), 1500);
    } catch (err: any) { toast.error(err.message); }
    setPasswordLoading(false);
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) { toast.error('Email is required'); return; }
    if (normalizedEmail === user.email) { toast.message('Email is already up to date'); return; }
    setEmailLoading(true);
    try {
      await api.updateEmail(user.id, normalizedEmail);
      await refreshProfile();
      toast.success('Email updated');
    } catch (err: any) { toast.error(err.message); }
    setEmailLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isAdmin) return;
    setLogoUploading(true);
    try {
      await api.uploadLogo(user.id, file);
      await refreshSettings();
      toast.success('Logo updated');
    } catch { toast.error('Failed to upload logo'); }
    setLogoUploading(false);
  };

  const handleAccentChange = async (color: string) => {
    if (!user) return;
    try {
      await api.updateProfile(user.id, { accentColor: color });
      refreshProfile();
      toast.success('Accent color updated');
    } catch { toast.error('Failed to update accent color'); }
  };

  const handleLogoRemove = async () => {
    if (!user || !isAdmin) return;
    setLogoRemoving(true);
    try {
      await api.removeLogo(user.id);
      await refreshSettings();
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
    setLogoRemoving(false);
  };

  const handleRegistrationToggle = async (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    try {
      await api.updateSettings({ registration_enabled: enabled });
      toast.success(enabled ? 'Registration enabled' : 'Registration disabled');
    } catch { toast.error('Failed to update setting'); }
  };

  return (
    <div className="max-w-2xl space-y-5 animate-page-in">
      <h2 className="text-xl font-semibold tracking-tight">Settings</h2>

      {isAdmin && (
        <Section>
          <h3 className="text-sm font-semibold">Access Control</h3>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Allow new user registration</p>
              <p className="text-xs text-muted-foreground">When disabled, only admins can create users from the Admin page.</p>
            </div>
            <Switch checked={registrationEnabled} onCheckedChange={handleRegistrationToggle} aria-label="Toggle registration" />
          </div>
        </Section>
      )}

      <Section>
        <h3 className="text-sm font-semibold">Change Email</h3>
        <form onSubmit={handleEmailChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New Email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" required className="h-10 rounded-lg" />
          </div>
          <Button type="submit" size="sm" className="rounded-lg" disabled={emailLoading}>
            {emailLoading ? 'Updating...' : 'Update Email'}
          </Button>
        </form>
      </Section>

      <Section>
        <h3 className="text-sm font-semibold">Change Password</h3>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required minLength={6} className="h-10 rounded-lg" />
          </div>
          <p className="text-xs text-muted-foreground">You will be signed out after changing your password.</p>
          <Button type="submit" size="sm" className="rounded-lg" disabled={passwordLoading}>
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Section>

      {isAdmin && (
        <Section>
          <h3 className="text-sm font-semibold">Workspace Logo</h3>
          <div className="flex items-center gap-4">
            {appSettings.workspace_logo_url ? (
              <img src={appSettings.workspace_logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <ImageOff className="w-5 h-5" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" />
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => document.getElementById('logo-upload')?.click()} disabled={logoUploading}>
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleLogoRemove} disabled={!appSettings.workspace_logo_url || logoRemoving}>
                {logoRemoving ? 'Removing...' : 'Remove Logo'}
              </Button>
            </div>
          </div>
        </Section>
      )}

      <Section>
        <h3 className="text-sm font-semibold">Accent Color</h3>
        <div className="flex gap-2.5">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleAccentChange(c)}
              className="w-8 h-8 rounded-full border-2 transition-all duration-150 hover:scale-110 active:scale-95"
              style={{ backgroundColor: c, borderColor: profile?.accent_color === c ? 'hsl(var(--foreground))' : 'transparent' }}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
