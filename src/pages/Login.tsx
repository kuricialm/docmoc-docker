import { useState } from 'react';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AlertCircle, FileText } from 'lucide-react';

export default function Login() {
  const { signIn, appSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [formError, setFormError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim() || !password) {
      setFormError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to sign in.');
      if (message === 'Invalid email or password') {
        setFormError('The password you entered is incorrect. Please try again.');
      } else {
        setFormError(message);
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!appSettings.registration_enabled) {
      toast.error('Registration is currently disabled');
      return;
    }
    if (!email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (password.length < 4) {
      setFormError('Password must be at least 4 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.registerUser(email, password, fullName || email);
      toast.success('Account created. You can now sign in.');
      setRegisterMode(false);
      setFullName('');
      setPassword('');
      setFormError('');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Unable to create account.'));
    }
    setLoading(false);
  };

  const submitHandler = registerMode ? handleRegister : handleLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="bg-background border border-border rounded-2xl shadow-sm p-7 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              {appSettings.workspace_logo_url ? (
                <img src={appSettings.workspace_logo_url} alt="Workspace Logo" className="w-9 h-9 rounded-lg object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
                  <FileText className="w-5 h-5 text-background" />
                </div>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Docmoc</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {registerMode ? 'Create your account' : 'Sign in to your workspace'}
            </p>
          </div>

          <form onSubmit={submitHandler} className="space-y-4" noValidate>
            {registerMode && (
              <div className="space-y-2">
                <Label htmlFor="full-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input id="full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="h-10 rounded-lg bg-muted border-transparent focus-visible:border-border focus-visible:ring-0" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="h-10 rounded-lg bg-muted border-transparent focus-visible:border-border focus-visible:ring-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required minLength={4} className="h-10 rounded-lg bg-muted border-transparent focus-visible:border-border focus-visible:ring-0" />
            </div>
            {formError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            {!registerMode && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Remember me for 30 days
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium rounded-lg mt-2" disabled={loading}>
              {loading ? (
                <span className="animate-pulse">Please wait...</span>
              ) : registerMode ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-5 text-center space-y-2">
            {appSettings.registration_enabled && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterMode(!registerMode);
                    setFormError('');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {registerMode ? 'Already have an account? Sign in' : 'Need an account? Register'}
                </button>
              </div>
            )}
            {!appSettings.registration_enabled && !registerMode && (
              <p className="text-xs text-muted-foreground/70">Registration is disabled. Contact an administrator.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
