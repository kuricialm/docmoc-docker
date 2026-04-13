import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [settings, setSettings] = useState<api.AppSettings>({ registration_enabled: true });

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.registration_enabled) {
      toast.error('Registration is currently disabled');
      return;
    }
    setLoading(true);
    try {
      await api.registerUser(email, password, fullName || email);
      toast.success('Account created. You can now sign in.');
      setRegisterMode(false);
      setFullName('');
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const submitHandler = registerMode ? handleRegister : handleLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border/50 rounded-2xl shadow-lg shadow-black/5 p-7 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Docmoc</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {registerMode ? 'Create your workspace account' : 'Sign in to your workspace'}
            </p>
          </div>

          <form onSubmit={submitHandler} className="space-y-4">
            {registerMode && (
              <div className="space-y-2">
                <Label htmlFor="full-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input id="full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="h-11 rounded-lg bg-secondary/30 border-border/40 focus:bg-card" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="h-11 rounded-lg bg-secondary/30 border-border/40 focus:bg-card" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required minLength={4} className="h-11 rounded-lg bg-secondary/30 border-border/40 focus:bg-card" />
            </div>
            <Button type="submit" className="w-full h-11 font-medium rounded-lg mt-2" disabled={loading}>
              {loading ? (
                <span className="animate-pulse">Please wait...</span>
              ) : registerMode ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-5 text-center space-y-2">
            {settings.registration_enabled && (
              <div>
                <button type="button" onClick={() => setRegisterMode(!registerMode)} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  {registerMode ? 'Already have an account? Sign in' : 'Need an account? Register'}
                </button>
              </div>
            )}
            {!settings.registration_enabled && !registerMode && (
              <p className="text-xs text-muted-foreground/70">Registration is disabled. Contact an administrator.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
