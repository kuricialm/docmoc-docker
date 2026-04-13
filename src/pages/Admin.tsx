import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Shield, User } from 'lucide-react';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
};

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const all = await api.getUsers();
      setUsers(all.map((u) => ({ id: u.id, email: u.email, full_name: u.fullName, role: u.role })));
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  if (!isAdmin) return <p className="text-center py-20 text-muted-foreground">Access denied</p>;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      await api.createUser(inviteEmail, invitePassword, inviteName || inviteEmail, inviteRole);
      toast.success('User created successfully');
      setShowInvite(false);
      setInviteEmail(''); setInviteName(''); setInvitePassword('');
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
    setInviteLoading(false);
  };

  const handleRoleChange = async () => {
    if (!editUser) return;
    try {
      await api.updateUserRole(editUser.id, editRole);
      toast.success('Role updated');
      setEditUser(null);
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
  };

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
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {u.role}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { setEditUser(u); setEditRole(u.role); }} className="gap-1.5 text-xs rounded-lg">
                    <Edit2 className="w-3 h-3" /> Edit Role
                  </Button>
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
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => { setEditUser(u); setEditRole(u.role); }} className="gap-1.5 text-xs rounded-lg">
                      <Edit2 className="w-3 h-3" /> Edit Role
                    </Button>
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
          <form onSubmit={handleInvite} className="space-y-3">
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
              <Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={6} className="h-10 rounded-lg" />
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
        <DialogContent className="max-w-xs rounded-xl">
          <DialogHeader><DialogTitle>Edit Role for {editUser?.full_name || editUser?.email}</DialogTitle></DialogHeader>
          <Select value={editRole} onValueChange={(v) => setEditRole(v as 'admin' | 'user')}>
            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRoleChange} className="w-full rounded-lg">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
