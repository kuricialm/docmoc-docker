import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTags, useTagMutations } from '@/hooks/useTags';
import { Edit2, Trash2, Plus } from 'lucide-react';

const TAG_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const ACCENT_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: tags } = useTags();
  const { createTag, updateTag, deleteTag } = useTagMutations();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success('Password updated');
      setCurrentPassword('');
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

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate({ name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
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

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold">Manage Tags</h3>
        <div className="space-y-2">
          {tags?.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 py-1.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              {editingTag === tag.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editTagName} onChange={(e) => setEditTagName(e.target.value)} className="h-7 text-sm flex-1" />
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { updateTag.mutate({ id: tag.id, name: editTagName, color: tag.color }); setEditingTag(null); }}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingTag(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <span className="text-sm flex-1">{tag.name}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingTag(tag.id); setEditTagName(tag.name); }}><Edit2 className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteTag.mutate(tag.id)}><Trash2 className="w-3 h-3" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="New tag name" className="h-8 text-sm flex-1" />
          <div className="flex gap-1">
            {TAG_COLORS.slice(0, 4).map((c) => (
              <button key={c} onClick={() => setNewTagColor(c)} className="w-5 h-5 rounded-full border" style={{ backgroundColor: c, borderColor: c === newTagColor ? 'hsl(var(--foreground))' : 'transparent' }} />
            ))}
          </div>
          <Button size="sm" onClick={handleCreateTag} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
        </div>
      </section>
    </div>
  );
}
