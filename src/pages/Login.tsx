import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  useEffect(() => {
    const fetchRegistrationSetting = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value_boolean')
        .eq('key', 'registration_enabled')
        .maybeSingle();

      setRegistrationEnabled(data?.value_boolean ?? true);
      setCheckingRegistration(false);
    };

    fetchRegistrationSetting();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registrationEnabled) {
      toast.error('Registration is currently disabled');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || email },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created. You can now sign in.');
      setRegisterMode(false);
      setFullName('');
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for a reset link');
      setForgotMode(false);
    }
    setLoading(false);
  };

  const submitHandler = forgotMode ? handleForgotPassword : registerMode ? handleRegister : handleLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Docmoc</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {forgotMode
              ? 'Enter your email to reset your password'
              : registerMode
                ? 'Create your workspace account'
                : 'Sign in to your workspace'}
          </p>
        </div>

        <form onSubmit={submitHandler} className="space-y-4">
          {registerMode && (
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="h-11"
            />
          </div>

          {!forgotMode && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                className="h-11"
              />
            </div>
          )}

          <Button type="submit" className="w-full h-11 font-medium" disabled={loading || checkingRegistration}>
            {loading
              ? 'Please wait...'
              : forgotMode
                ? 'Send Reset Link'
                : registerMode
                  ? 'Create Account'
                  : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button
            type="button"
            onClick={() => {
              setForgotMode(!forgotMode);
              setRegisterMode(false);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {forgotMode ? 'Back to sign in' : 'Forgot password?'}
          </button>

          {!forgotMode && registrationEnabled && (
            <div>
              <button
                type="button"
                onClick={() => setRegisterMode(!registerMode)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {registerMode ? 'Already have an account? Sign in' : 'Need an account? Register'}
              </button>
            </div>
          )}

          {!forgotMode && !registrationEnabled && (
            <p className="text-xs text-muted-foreground">Registration is disabled. Contact an administrator.</p>
          )}
        </div>
      </div>
    </div>
  );
}
