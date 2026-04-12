import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  document_count?: number;
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
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    if (profiles) {
      const mapped: UserProfile[] = profiles.map((p) => {
        const userRole = roles?.find((r) => r.user_id === p.id);
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: (userRole?.role as 'admin' | 'user') || 'user',
        };
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  if (!isAdmin) return <p className="text-center py-20 text-muted-foreground">Access denied</p>;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: inviteEmail, password: invitePassword, fullName: inviteName, role: inviteRole },
    });

    if (error) {
      toast.error(error.message || 'Failed to create user');
    } else {
      toast.success('User created successfully');
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      fetchUsers();
    }
    setInviteLoading(false);
  };

  const handleRoleChange = async () => {
    if (!editUser) return;
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', editUser.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('user_roles').update({ role: editRole }).eq('id', existing.id);
    } else {
      await supabase.from('user_roles').insert({ user_id: editUser.id, role: editRole });
    }

    toast.success('Role updated');
    setEditUser(null);
    fetchUsers();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Admin - User Management</h2>
        <Button size="sm" onClick={() => setShowInvite(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create User
        </Button>
      </div>

      <div className="bg-card border rounded-lg divide-y">
        {loading ? (
          <p className="p-8 text-center text-muted-foreground text-sm">Loading...</p>
        ) : users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              {(u.full_name || u.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{u.full_name || u.email}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
              {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {u.role}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setEditUser(u); setEditRole(u.role); }} className="gap-1.5 text-xs">
              <Edit2 className="w-3 h-3" /> Edit Role
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Doe" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={6} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'user')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={inviteLoading}>
              {inviteLoading ? 'Creating...' : 'Create User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Edit Role for {editUser?.full_name || editUser?.email}</DialogTitle></DialogHeader>
          <Select value={editRole} onValueChange={(v) => setEditRole(v as 'admin' | 'user')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRoleChange} className="w-full">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
