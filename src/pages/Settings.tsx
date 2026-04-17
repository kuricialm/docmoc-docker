import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Check, ImageOff, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useLocalSettings } from '@/hooks/useLocalSettings';

const ACCENT_COLORS = ['#000000', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];
const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`bg-background border border-border rounded-xl p-5 sm:p-6 space-y-4 hover:border-border/80 transition-colors duration-150 ${className}`}>
    {children}
  </section>
);

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatModelPricing(model: api.OpenRouterModelOption) {
  const parts = [];
  if (typeof model.prompt_price === 'number') parts.push(`Prompt ${model.prompt_price.toFixed(6)}`);
  if (typeof model.completion_price === 'number') parts.push(`Completion ${model.completion_price.toFixed(6)}`);
  return parts.join(' • ');
}

function formatModelOptionLabel(model: api.OpenRouterModelOption) {
  const metadata = [
    model.id,
    model.context_length > 0 ? `${model.context_length.toLocaleString()} ctx` : null,
    formatModelPricing(model) || null,
  ].filter(Boolean);

  return `${model.name}${metadata.length ? ` — ${metadata.join(' • ')}` : ''}`;
}

type BatchProgress = NonNullable<NonNullable<api.OpenRouterSettings['summary_backfill']>['batches']>['missing'];

function formatBatchProgress(batch: BatchProgress) {
  if (!batch || batch.total <= 0) return null;
  return `${batch.completed}/${batch.total} processed${batch.failed ? ` • ${batch.failed} failed` : ''}`;
}

export default function SettingsPage() {
  const { settings: localSettings, update: updateLocalSettings } = useLocalSettings();
  const { user, profile, refreshProfile, isAdmin, signOut, appSettings, refreshSettings } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconRemoving, setFaviconRemoving] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [openRouterSettings, setOpenRouterSettings] = useState<api.OpenRouterSettings | null>(null);
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterSavingKey, setOpenRouterSavingKey] = useState(false);
  const [openRouterRefreshingModels, setOpenRouterRefreshingModels] = useState(false);
  const [openRouterRemovingKey, setOpenRouterRemovingKey] = useState(false);
  const [openRouterSavingPrefs, setOpenRouterSavingPrefs] = useState(false);
  const [openRouterBackfilling, setOpenRouterBackfilling] = useState(false);
  const [openRouterRegeneratingAll, setOpenRouterRegeneratingAll] = useState(false);
  const [textModelId, setTextModelId] = useState('');
  const [visionModelId, setVisionModelId] = useState('');
  const [summaryPrompt, setSummaryPrompt] = useState('');

  useEffect(() => { setNewEmail(user?.email ?? ''); }, [user?.email]);
  useEffect(() => { setDisplayName(profile?.full_name ?? ''); }, [profile?.full_name]);

  useEffect(() => {
    if (isAdmin) {
      api.getSettings().then((s) => setRegistrationEnabled(s.registration_enabled)).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      setOpenRouterSettings(null);
      return;
    }

    let cancelled = false;
    setOpenRouterLoading(true);
    api.getOpenRouterSettings()
      .then((settings) => {
        if (!cancelled) setOpenRouterSettings(settings);
      })
      .catch((error: Error) => {
        if (!cancelled) toast.error(error.message);
      })
      .finally(() => {
        if (!cancelled) setOpenRouterLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    setTextModelId(openRouterSettings?.preferences.text_model_id ?? '');
    setVisionModelId(openRouterSettings?.preferences.vision_model_id ?? '');
    setSummaryPrompt(openRouterSettings?.preferences.summary_prompt ?? openRouterSettings?.preferences.summary_prompt_default ?? '');
  }, [
    openRouterSettings?.preferences.text_model_id,
    openRouterSettings?.preferences.vision_model_id,
    openRouterSettings?.preferences.summary_prompt,
    openRouterSettings?.preferences.summary_prompt_default,
  ]);

  const summaryPromptDefault = openRouterSettings?.preferences.summary_prompt_default ?? '';
  const hasCustomSummaryPrompt = summaryPrompt.trim() !== summaryPromptDefault.trim();
  const credentialIndicator = !openRouterSettings?.configured
    ? {
        label: 'No OpenRouter key configured',
        dotClassName: 'bg-slate-400 ring-slate-300/70',
      }
    : (openRouterSettings.credential?.status === 'valid' && !openRouterSettings.credential?.last_error)
      ? {
          label: 'OpenRouter key connected and validated',
          dotClassName: 'bg-emerald-500 ring-emerald-400/60 animate-pulse',
        }
      : {
          label: 'OpenRouter key disconnected or not validated',
          dotClassName: 'bg-rose-500 ring-rose-400/60 animate-pulse',
        };

  useEffect(() => {
    const hasActiveSummaryBatch = !!openRouterSettings?.summary_backfill?.batches?.missing?.active
      || !!openRouterSettings?.summary_backfill?.batches?.regenerate?.active
      || !!openRouterSettings?.summary_backfill?.queue_size;
    if (!user || !hasActiveSummaryBatch) return undefined;

    const intervalId = window.setInterval(() => {
      api.getOpenRouterSettings()
        .then((settings) => setOpenRouterSettings(settings))
        .catch(() => {});
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [
    user,
    openRouterSettings?.summary_backfill?.queue_size,
    openRouterSettings?.summary_backfill?.batches?.missing?.active,
    openRouterSettings?.summary_backfill?.batches?.regenerate?.active,
  ]);

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

  const handleDisplayNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error('Display name is required');
      return;
    }
    if (trimmed === (profile?.full_name || '').trim()) {
      toast.message('Display name is already up to date');
      return;
    }
    setDisplayNameLoading(true);
    try {
      await api.updateProfile(user.id, { fullName: trimmed });
      await refreshProfile();
      toast.success('Display name updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update display name');
    }
    setDisplayNameLoading(false);
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

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isAdmin) return;
    setFaviconUploading(true);
    try {
      await api.uploadFavicon(user.id, file);
      await refreshSettings();
      toast.success('Favicon updated');
    } catch {
      toast.error('Failed to upload favicon');
    }
    setFaviconUploading(false);
  };

  const handleFaviconRemove = async () => {
    if (!user || !isAdmin) return;
    setFaviconRemoving(true);
    try {
      await api.removeFavicon(user.id);
      await refreshSettings();
      toast.success('Favicon removed');
    } catch {
      toast.error('Failed to remove favicon');
    }
    setFaviconRemoving(false);
  };

  const handleRegistrationToggle = async (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    try {
      await api.updateSettings({ registration_enabled: enabled });
      toast.success(enabled ? 'Registration enabled' : 'Registration disabled');
    } catch { toast.error('Failed to update setting'); }
  };

  const handleOpenRouterKeySave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = openRouterKey.trim();
    if (!trimmedKey) {
      toast.error('Paste your OpenRouter API key first');
      return;
    }

    setOpenRouterSavingKey(true);
    try {
      const settings = await api.saveOpenRouterKey(trimmedKey);
      setOpenRouterSettings(settings);
      setOpenRouterKey('');
      toast.success('OpenRouter key validated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate the OpenRouter key');
    }
    setOpenRouterSavingKey(false);
  };

  const handleOpenRouterRefreshModels = async () => {
    setOpenRouterRefreshingModels(true);
    try {
      const settings = await api.refreshOpenRouterModels();
      setOpenRouterSettings(settings);
      toast.success('Model list refreshed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh models');
    }
    setOpenRouterRefreshingModels(false);
  };

  const handleOpenRouterRemoveKey = async () => {
    setOpenRouterRemovingKey(true);
    try {
      await api.removeOpenRouterKey();
      setOpenRouterSettings({
        provider: 'openrouter',
        configured: false,
        credential: null,
        preferences: {
          text_model_id: null,
          vision_model_id: null,
          summary_prompt: summaryPrompt,
          summary_prompt_default: summaryPromptDefault,
          text_model_valid: false,
          vision_model_valid: false,
        },
        models: {
          text: [],
          vision: [],
          fetched_at: null,
        },
        summary_backfill: {
          missing_count: 0,
          queue_size: 0,
          auto_generate_on_upload: true,
        },
      });
      setTextModelId('');
      setVisionModelId('');
      toast.success('OpenRouter key removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove the OpenRouter key');
    }
    setOpenRouterRemovingKey(false);
  };

  const handleOpenRouterPreferenceSave = async () => {
    if (!textModelId || !visionModelId) {
      toast.error('Choose both a text model and a vision model');
      return;
    }

    setOpenRouterSavingPrefs(true);
    try {
      const settings = await api.saveOpenRouterPreferences({
        textModelId,
        visionModelId,
        summaryPrompt,
      });
      setOpenRouterSettings(settings);
      toast.success('AI model preferences saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save AI model preferences');
    }
    setOpenRouterSavingPrefs(false);
  };

  const handleOpenRouterBackfill = async () => {
    setOpenRouterBackfilling(true);
    try {
      const response = await api.queueMissingOpenRouterSummaries();
      setOpenRouterSettings(response.settings);
      toast.success(response.queued > 0 ? `Queued ${response.queued} summaries` : 'No files are currently missing summaries');
    } catch (error: any) {
      toast.error(error.message || 'Failed to queue missing summaries');
    }
    setOpenRouterBackfilling(false);
  };

  const handleOpenRouterRegenerateAll = async () => {
    setOpenRouterRegeneratingAll(true);
    try {
      const response = await api.regenerateAllOpenRouterSummaries();
      setOpenRouterSettings(response.settings);
      toast.success(response.queued > 0 ? `Queued ${response.queued} summaries for regeneration` : 'No documents are currently ready to regenerate');
    } catch (error: any) {
      toast.error(error.message || 'Failed to queue summary regeneration');
    }
    setOpenRouterRegeneratingAll(false);
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
        <h3 className="text-sm font-semibold">Display Name</h3>
        <form onSubmit={handleDisplayNameChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your display name" required className="h-10 rounded-lg" />
          </div>
          <Button type="submit" size="sm" className="rounded-lg" disabled={displayNameLoading}>
            {displayNameLoading ? 'Updating...' : 'Update Name'}
          </Button>
        </form>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section>
          <h3 className="text-sm font-semibold">Change Email</h3>
          <form onSubmit={handleEmailChange} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" required className="h-10 rounded-lg" />
              <p className="text-xs text-muted-foreground">
                You can update your email easily from this setting.
              </p>
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
      </div>

      <Section>
        <h3 className="text-sm font-semibold">OpenRouter</h3>
        <p className="text-sm text-muted-foreground">
          Add your personal OpenRouter API key, validate it, and choose the default models used for document summaries.
        </p>

        {openRouterLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading AI settings...
          </div>
        ) : (
          <>
            <form onSubmit={handleOpenRouterKeySave} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">OpenRouter API Key</Label>
                <Input
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder={openRouterSettings?.configured ? 'Paste a new key to replace the current one' : 'sk-or-v1-...'}
                  className="h-10 rounded-lg"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" className="rounded-lg" disabled={openRouterSavingKey}>
                  {openRouterSavingKey ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  {openRouterSavingKey ? 'Validating...' : 'Save & Validate'}
                </Button>
                {openRouterSettings?.configured && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={handleOpenRouterRefreshModels}
                      disabled={openRouterRefreshingModels}
                    >
                      {openRouterRefreshingModels ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                      {openRouterRefreshingModels ? 'Refreshing...' : 'Refresh Models'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-destructive hover:text-destructive"
                      onClick={handleOpenRouterRemoveKey}
                      disabled={openRouterRemovingKey}
                    >
                      {openRouterRemovingKey ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                      {openRouterRemovingKey ? 'Removing...' : 'Remove Key'}
                    </Button>
                  </>
                )}
              </div>
            </form>

            {openRouterSettings?.configured ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/25 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-inset ${credentialIndicator.dotClassName}`}
                      role="img"
                      aria-label={credentialIndicator.label}
                      title={credentialIndicator.label}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <p>
                        Key: <span className="font-medium text-foreground">{openRouterSettings.credential?.key_label || openRouterSettings.credential?.masked_key || 'Validated'}</span>
                      </p>
                      {openRouterSettings.credential?.masked_key && <p>Mask: {openRouterSettings.credential.masked_key}</p>}
                      {formatDateTime(openRouterSettings.credential?.validated_at) && <p>Validated: {formatDateTime(openRouterSettings.credential?.validated_at)}</p>}
                      {formatDateTime(openRouterSettings.credential?.expires_at) && <p>Expires: {formatDateTime(openRouterSettings.credential?.expires_at)}</p>}
                      {formatDateTime(openRouterSettings.credential?.last_model_sync_at) && <p>Models synced: {formatDateTime(openRouterSettings.credential?.last_model_sync_at)}</p>}
                    </div>
                  </div>
                  {openRouterSettings.credential?.last_error && (
                    <p className="mt-2 text-sm text-destructive">{openRouterSettings.credential.last_error}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Default Text Summary Model</Label>
                    <select
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                      value={textModelId}
                      onChange={(e) => setTextModelId(e.target.value)}
                    >
                      <option value="">Choose a text model</option>
                      {openRouterSettings.models.text.map((model) => (
                        <option key={model.id} value={model.id}>
                          {formatModelOptionLabel(model)}
                        </option>
                      ))}
                    </select>
                    {!openRouterSettings.preferences.text_model_valid && openRouterSettings.preferences.text_model_id && (
                      <p className="text-xs text-destructive">Your saved text model is no longer available. Choose a new one.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Default Vision Summary Model</Label>
                    <select
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                      value={visionModelId}
                      onChange={(e) => setVisionModelId(e.target.value)}
                    >
                      <option value="">Choose a vision model</option>
                      {openRouterSettings.models.vision.map((model) => (
                        <option key={model.id} value={model.id}>
                          {formatModelOptionLabel(model)}
                        </option>
                      ))}
                    </select>
                    {!openRouterSettings.preferences.vision_model_valid && openRouterSettings.preferences.vision_model_id && (
                      <p className="text-xs text-destructive">Your saved vision model is no longer available. Choose a new one.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Summary Prompt</Label>
                  <Textarea
                    value={summaryPrompt}
                    onChange={(e) => setSummaryPrompt(e.target.value)}
                    className="min-h-[110px] w-full resize-y rounded-lg text-sm leading-6 md:min-h-[130px]"
                    placeholder="Describe how Docmoc should summarize your documents"
                    rows={5}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="text-xs text-muted-foreground sm:flex-1">
                      Docmoc now sends this as the main instruction and shows the returned text directly in the document summary card. It only adds the document content and basic file metadata around your prompt.
                    </p>
                    {hasCustomSummaryPrompt && summaryPromptDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 rounded-md px-2 text-xs sm:mt-0.5"
                        onClick={() => setSummaryPrompt(summaryPromptDefault)}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Reset to Default
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Text documents use your text model. Image files use your vision model. New uploads will be summarized automatically when your setup is ready.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg"
                    onClick={handleOpenRouterPreferenceSave}
                    disabled={openRouterSavingPrefs || !textModelId || !visionModelId}
                  >
                    {openRouterSavingPrefs ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {openRouterSavingPrefs ? 'Saving...' : 'Save Model Preferences'}
                  </Button>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Summary jobs for existing files</p>
                    <p className="text-sm text-muted-foreground">
                      {openRouterSettings.summary_backfill?.missing_count
                        ? `${openRouterSettings.summary_backfill.missing_count} files still need a summary.`
                        : 'All existing files already have a summary or are currently being processed.'}
                    </p>
                    {(openRouterSettings.summary_backfill?.queue_size || 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {openRouterSettings.summary_backfill?.queue_size} summaries are currently being generated in the background.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={handleOpenRouterBackfill}
                        disabled={openRouterBackfilling || !openRouterSettings.summary_backfill?.missing_count}
                      >
                        {openRouterBackfilling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        {openRouterBackfilling ? 'Queueing...' : 'Generate All Missing Summaries'}
                      </Button>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {openRouterSettings.summary_backfill?.batches?.missing?.active
                            ? `${openRouterSettings.summary_backfill.batches.missing.completed}/${openRouterSettings.summary_backfill.batches.missing.total}`
                            : `${0}/${openRouterSettings.summary_backfill?.missing_count || 0}`}
                        </span>
                        <span>
                          {openRouterSettings.summary_backfill?.batches?.missing?.active
                            ? `${openRouterSettings.summary_backfill.batches.missing.progress_percent}%`
                            : 'Ready'}
                        </span>
                      </div>
                      <Progress
                        value={openRouterSettings.summary_backfill?.batches?.missing?.active
                          ? openRouterSettings.summary_backfill.batches.missing.progress_percent
                          : 0}
                        className="h-2"
                      />
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={handleOpenRouterRegenerateAll}
                        disabled={openRouterRegeneratingAll || !openRouterSettings.summary_backfill?.regeneratable_count}
                      >
                        {openRouterRegeneratingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                        {openRouterRegeneratingAll ? 'Queueing...' : 'Regenerate All Summaries'}
                      </Button>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {openRouterSettings.summary_backfill?.batches?.regenerate?.active
                            ? `${openRouterSettings.summary_backfill.batches.regenerate.completed}/${openRouterSettings.summary_backfill.batches.regenerate.total}`
                            : `${0}/${openRouterSettings.summary_backfill?.regeneratable_count || 0}`}
                        </span>
                        <span>
                          {openRouterSettings.summary_backfill?.batches?.regenerate?.active
                            ? `${openRouterSettings.summary_backfill.batches.regenerate.progress_percent}%`
                            : 'Ready'}
                        </span>
                      </div>
                      <Progress
                        value={openRouterSettings.summary_backfill?.batches?.regenerate?.active
                          ? openRouterSettings.summary_backfill.batches.regenerate.progress_percent
                          : 0}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-inset ${credentialIndicator.dotClassName}`}
                    role="img"
                    aria-label={credentialIndicator.label}
                    title={credentialIndicator.label}
                  />
                  <span>After validation, Docmoc will load your available OpenRouter models so you can choose separate defaults for text documents and images.</span>
                </div>
              </div>
            )}
          </>
        )}
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
          <div className="pt-2 border-t border-border/60 flex items-center gap-4">
            {appSettings.workspace_favicon_url ? (
              <img src={appSettings.workspace_favicon_url} alt="Favicon" className="w-8 h-8 rounded object-cover border border-border" />
            ) : (
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                <ImageOff className="w-4 h-4" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/x-icon,image/png,image/svg+xml,image/*" onChange={handleFaviconUpload} className="hidden" id="favicon-upload" />
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => document.getElementById('favicon-upload')?.click()} disabled={faviconUploading}>
                {faviconUploading ? 'Uploading...' : 'Upload Favicon'}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleFaviconRemove} disabled={!appSettings.workspace_favicon_url || faviconRemoving}>
                {faviconRemoving ? 'Removing...' : 'Remove Favicon'}
              </Button>
            </div>
          </div>
        </Section>
      )}

      <Section>
        <h3 className="text-sm font-semibold">Display</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Thumbnail Previews</p>
            <p className="text-xs text-muted-foreground">Show document previews for PDFs and images on cards instead of icons.</p>
          </div>
          <Switch
            checked={localSettings.thumbnailPreviews}
            onCheckedChange={(v) => updateLocalSettings({ thumbnailPreviews: v })}
            aria-label="Toggle thumbnail previews"
          />
        </div>
      </Section>

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
