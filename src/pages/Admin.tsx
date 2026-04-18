import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Shield, User, KeyRound, Trash2 } from 'lucide-react';
import { formatFileSize } from '@/lib/fileTypes';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  suspended: boolean;
  last_sign_in_at: string | null;
  total_uploaded_size: number;
  upload_quota_bytes: number | null;
};

function mapUserProfile(user: api.User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    suspended: !!user.suspended,
    last_sign_in_at: user.lastSignInAt || null,
    total_uploaded_size: user.totalUploadedSize || 0,
    upload_quota_bytes: user.uploadQuotaBytes ?? null,
  };
}

export default function AdminPage() {
  const { isAdmin, user, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editQuotaGb, setEditQuotaGb] = useState('');
  const [passwordResetValue, setPasswordResetValue] = useState('');
  const bytesPerGb = 1024 * 1024 * 1024;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const all = await api.getUsers();
      setUsers(all.map(mapUserProfile));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load users'));
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  if (!isAdmin) return <p className="text-center py-20 text-muted-foreground">Access denied</p>;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    if (invitePassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setInviteLoading(true);
    try {
      await api.createUser(inviteEmail, invitePassword, inviteName || inviteEmail, inviteRole);
      toast.success('User created successfully');
      setShowInvite(false);
      setInviteEmail(''); setInviteName(''); setInvitePassword('');
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create user'));
    }
    setInviteLoading(false);
  };

  const handleUserUpdate = async () => {
    if (!editUser) return;
    let uploadQuotaBytes: number | null | undefined = undefined;
    if (editQuotaGb.trim() === '') {
      uploadQuotaBytes = null;
    } else {
      const parsedGb = Number(editQuotaGb);
      if (!Number.isFinite(parsedGb) || parsedGb < 0) {
        toast.error('Upload quota must be a number of 0 GB or more, or leave it empty for unlimited.');
        return;
      }
      uploadQuotaBytes = Math.floor(parsedGb * bytesPerGb);
    }
    try {
      await api.updateUser(editUser.id, {
        fullName: editName,
        email: editEmail,
        role: editRole,
        uploadQuotaBytes,
      });
      toast.success('User updated');
      if (editUser.id === user?.id) {
        await refreshProfile();
      }
      setEditUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update user'));
    }
  };

  const handlePasswordReset = async () => {
    if (!editUser) return;
    try {
      await api.resetUserPassword(editUser.id, passwordResetValue);
      toast.success('Password reset successfully');
      setPasswordResetValue('');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to reset password'));
    }
  };

  const handleDeleteUser = async () => {
    if (!editUser) return;
    if (!window.confirm(`Delete ${editUser.full_name || editUser.email}? This cannot be undone.`)) return;
    try {
      await api.deleteUser(editUser.id);
      toast.success('User deleted');
      setEditUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete user'));
    }
  };

  const handleSuspendToggle = async (target: UserProfile) => {
    const nextSuspended = !target.suspended;
    if (nextSuspended && !window.confirm(`Suspend ${target.full_name || target.email}?`)) return;
    try {
      await api.updateUser(target.id, { suspended: nextSuspended });
      toast.success(nextSuspended ? 'User suspended' : 'User unsuspended');
      if (target.id === user?.id) {
        await refreshProfile();
      }
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update suspension'));
    }
  };

  const formatLastSignIn = (value: string | null) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  };

  const openEditUser = (u: UserProfile) => {
    setEditUser(u);
    setEditRole(u.role);
    setEditName(u.full_name || '');
    setEditEmail(u.email);
    if (u.upload_quota_bytes === null) {
      setEditQuotaGb('');
    } else {
      const rawGb = u.upload_quota_bytes / bytesPerGb;
      const normalized = rawGb.toFixed(6).replace(/\.?0+$/, '');
      setEditQuotaGb(normalized || '0');
    }
    setPasswordResetValue('');
  };

  const editUsedBytes = editUser?.total_uploaded_size || 0;
  const parsedQuotaGb = editQuotaGb.trim() === '' ? null : Number(editQuotaGb);
  const editQuotaBytesPreview = parsedQuotaGb === null
    ? null
    : Number.isFinite(parsedQuotaGb) && parsedQuotaGb >= 0
      ? Math.floor(parsedQuotaGb * bytesPerGb)
      : undefined;
  const editAvailableBytesPreview = typeof editQuotaBytesPreview === 'number'
    ? Math.max(0, editQuotaBytesPreview - editUsedBytes)
    : null;
  const editUsedPercentPreview = typeof editQuotaBytesPreview === 'number'
    ? (editQuotaBytesPreview <= 0 ? (editUsedBytes > 0 ? 100 : 0) : Math.min(100, (editUsedBytes / editQuotaBytesPreview) * 100))
    : null;

  return (
    <div className="max-w-3xl space-y-6 animate-page-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">User Management</h2>
        <Button size="sm" onClick={() => setShowInvite(true)} className="gap-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Create User
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted-foreground text-sm">Loading...</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block divide-y divide-border/30">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors duration-150">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-semibold text-primary">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground/70">{u.email}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Last sign-in: {formatLastSignIn(u.last_sign_in_at)}</p>
                    <p className="text-xs text-muted-foreground/70">Uploads: {formatFileSize(u.total_uploaded_size)}</p>
                    <p className="text-xs text-muted-foreground/70">Quota: {u.upload_quota_bytes === null ? 'Unlimited' : formatFileSize(u.upload_quota_bytes)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {u.role}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={u.suspended ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleSuspendToggle(u)}
                      className="text-xs rounded-lg"
                    >
                      {u.suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} className="gap-1.5 text-xs rounded-lg">
                      <Edit2 className="w-3 h-3" /> Edit User
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/30">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-semibold text-primary">
                      {(u.full_name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Last sign-in: {formatLastSignIn(u.last_sign_in_at)}</p>
                      <p className="text-xs text-muted-foreground/70">Uploads: {formatFileSize(u.total_uploaded_size)}</p>
                      <p className="text-xs text-muted-foreground/70">Quota: {u.upload_quota_bytes === null ? 'Unlimited' : formatFileSize(u.upload_quota_bytes)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                        {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={u.suspended ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleSuspendToggle(u)}
                        className="text-xs rounded-lg"
                      >
                        {u.suspended ? 'Unsuspend' : 'Suspend'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} className="gap-1.5 text-xs rounded-lg">
                        <Edit2 className="w-3 h-3" /> Edit User
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Doe" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={4} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'user')}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={inviteLoading}>
              {inviteLoading ? 'Creating...' : 'Create User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg rounded-xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <DialogTitle className="text-base">Edit User</DialogTitle>
            <p className="text-xs text-muted-foreground">{editUser?.full_name || editUser?.email}</p>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
            <section className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Full Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as 'admin' | 'user')}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Storage</p>
              <div className="space-y-1">
                <Label className="text-xs">Upload Quota (GB)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editQuotaGb}
                  onChange={(e) => setEditQuotaGb(e.target.value)}
                  placeholder="Empty = unlimited"
                  className="h-9 rounded-lg"
                />
              </div>
            </section>

            <div className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2 -mt-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums leading-tight">
                <p>Used: {formatFileSize(editUsedBytes)}</p>
                <p>Total: {editQuotaBytesPreview === null ? 'Unlimited' : editQuotaBytesPreview === undefined ? 'Invalid value' : formatFileSize(editQuotaBytesPreview)}</p>
                <p>Available: {editQuotaBytesPreview === null ? 'Unlimited' : editAvailableBytesPreview === null ? '-' : formatFileSize(editAvailableBytesPreview)}</p>
                <p>Used %: {editQuotaBytesPreview === null ? 'N/A' : editUsedPercentPreview === null ? '-' : `${editUsedPercentPreview.toFixed(1)}%`}</p>
              </div>
            </div>

            <section className="pt-1 border-t border-border/50 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Password Reset</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={passwordResetValue}
                  minLength={4}
                  onChange={(e) => setPasswordResetValue(e.target.value)}
                  placeholder="New password"
                  className="h-9 rounded-lg"
                />
                <Button type="button" variant="secondary" onClick={handlePasswordReset} disabled={passwordResetValue.length < 4} className="h-9 px-3">
                  <KeyRound className="w-4 h-4 mr-1" /> Reset
                </Button>
              </div>
            </section>

            <section className="pt-1 border-t border-destructive/30 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Danger Zone</p>
              <Button type="button" variant="destructive" onClick={handleDeleteUser} className="w-full h-9 rounded-lg">
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete User
              </Button>
            </section>
          </div>

          <div className="px-5 py-3 border-t border-border/50 bg-background/95 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditUser(null)} className="h-9 rounded-lg">Cancel</Button>
            <Button onClick={handleUserUpdate} className="h-9 rounded-lg">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
