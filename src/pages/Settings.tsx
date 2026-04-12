import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ACCENT_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success('Password updated');
      setNewPassword('');
    }
    setPasswordLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLogoUploading(true);
    const path = `${user.id}/logo.${file.name.split('.').pop()}`;
    await supabase.storage.from('workspace-logos').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('workspace-logos').getPublicUrl(path);
    await supabase.from('profiles').update({ workspace_logo_url: data.publicUrl }).eq('id', user.id);
    await refreshProfile();
    toast.success('Logo updated');
    setLogoUploading(false);
  };

  const handleAccentChange = async (color: string) => {
    if (!user) return;
    await supabase.from('profiles').update({ accent_color: color }).eq('id', user.id);
    await refreshProfile();
    toast.success('Accent color updated');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-lg font-semibold">Settings</h2>

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
