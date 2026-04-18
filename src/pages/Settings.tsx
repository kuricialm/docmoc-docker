import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Check, ImageOff, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalSettings } from '@/hooks/useLocalSettings';
import * as api from '@/lib/api';
import { formatDateTime } from '@/lib/dateTime';
import { getErrorMessage } from '@/lib/errors';
import {
  createEmptyOpenRouterSettings,
  formatModelOptionLabel,
  getOpenRouterCredentialIndicator,
  hasActiveOpenRouterBatch,
} from '@/lib/openRouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  SAFE_FAVICON_UPLOAD_ACCEPT,
  SAFE_LOGO_UPLOAD_ACCEPT,
} from '@/lib/security';

const ACCENT_COLORS = ['#000000', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#06B6D4'];

const Section = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`bg-background border border-border rounded-xl p-5 sm:p-6 space-y-4 hover:border-border/80 transition-colors duration-150 ${className}`}>
    {children}
  </section>
);

type BusyKey =
  | 'password'
  | 'email'
  | 'displayName'
  | 'trashRetention'
  | 'logoUpload'
  | 'logoRemove'
  | 'faviconUpload'
  | 'faviconRemove'
  | 'openRouterSaveKey'
  | 'openRouterRefreshModels'
  | 'openRouterRemoveKey'
  | 'openRouterSavePrefs'
  | 'openRouterBackfill'
  | 'openRouterRegenerateAll';

type BusyState = Record<BusyKey, boolean>;

const INITIAL_BUSY_STATE: BusyState = {
  password: false,
  email: false,
  displayName: false,
  trashRetention: false,
  logoUpload: false,
  logoRemove: false,
  faviconUpload: false,
  faviconRemove: false,
  openRouterSaveKey: false,
  openRouterRefreshModels: false,
  openRouterRemoveKey: false,
  openRouterSavePrefs: false,
  openRouterBackfill: false,
  openRouterRegenerateAll: false,
};

type OpenRouterSectionProps = {
  loading: boolean;
  settings: api.OpenRouterSettings | null;
  openRouterKey: string;
  textModelId: string;
  visionModelId: string;
  summaryPrompt: string;
  summaryPromptDefault: string;
  hasCustomSummaryPrompt: boolean;
  credentialIndicator: ReturnType<typeof getOpenRouterCredentialIndicator>;
  busyState: BusyState;
  onOpenRouterKeyChange: (value: string) => void;
  onTextModelIdChange: (value: string) => void;
  onVisionModelIdChange: (value: string) => void;
  onSummaryPromptChange: (value: string) => void;
  onResetSummaryPrompt: () => void;
  onSaveKey: (event: FormEvent) => void;
  onRefreshModels: () => void;
  onRemoveKey: () => void;
  onSavePreferences: () => void;
  onBackfill: () => void;
  onRegenerateAll: () => void;
};

function OpenRouterSection({
  loading,
  settings,
  openRouterKey,
  textModelId,
  visionModelId,
  summaryPrompt,
  summaryPromptDefault,
  hasCustomSummaryPrompt,
  credentialIndicator,
  busyState,
  onOpenRouterKeyChange,
  onTextModelIdChange,
  onVisionModelIdChange,
  onSummaryPromptChange,
  onResetSummaryPrompt,
  onSaveKey,
  onRefreshModels,
  onRemoveKey,
  onSavePreferences,
  onBackfill,
  onRegenerateAll,
}: OpenRouterSectionProps) {
  return (
    <Section>
      <h3 className="text-sm font-semibold">OpenRouter</h3>
      <p className="text-sm text-muted-foreground">
        Add your personal OpenRouter API key, validate it, and choose the default models used for document summaries.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AI settings...
        </div>
      ) : (
        <>
          <form onSubmit={onSaveKey} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">OpenRouter API Key</Label>
              <Input
                type="password"
                value={openRouterKey}
                onChange={(event) => onOpenRouterKeyChange(event.target.value)}
                placeholder={settings?.configured ? 'Paste a new key to replace the current one' : 'sk-or-v1-...'}
                className="h-10 rounded-lg"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" className="rounded-lg" disabled={busyState.openRouterSaveKey}>
                {busyState.openRouterSaveKey ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                {busyState.openRouterSaveKey ? 'Validating...' : 'Save & Validate'}
              </Button>
              {settings?.configured && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={onRefreshModels}
                    disabled={busyState.openRouterRefreshModels}
                  >
                    {busyState.openRouterRefreshModels ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                    {busyState.openRouterRefreshModels ? 'Refreshing...' : 'Refresh Models'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghostDestructive"
                    className="rounded-lg"
                    onClick={onRemoveKey}
                    disabled={busyState.openRouterRemoveKey}
                  >
                    {busyState.openRouterRemoveKey ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                    {busyState.openRouterRemoveKey ? 'Removing...' : 'Remove Key'}
                  </Button>
                </>
              )}
            </div>
          </form>

          {settings?.configured ? (
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
                      Key: <span className="font-medium text-foreground">{settings.credential?.key_label || settings.credential?.masked_key || 'Validated'}</span>
                    </p>
                    {formatDateTime(settings.credential?.validated_at) && <p>Validated: {formatDateTime(settings.credential?.validated_at)}</p>}
                    {formatDateTime(settings.credential?.expires_at) && <p>Expires: {formatDateTime(settings.credential?.expires_at)}</p>}
                    {formatDateTime(settings.credential?.last_model_sync_at) && <p>Models synced: {formatDateTime(settings.credential?.last_model_sync_at)}</p>}
                  </div>
                </div>
                {settings.credential?.last_error && (
                  <p className="mt-2 text-sm text-destructive">{settings.credential.last_error}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Default Text Summary Model</Label>
                  <select
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    value={textModelId}
                    onChange={(event) => onTextModelIdChange(event.target.value)}
                  >
                    <option value="">Choose a text model</option>
                    {settings.models.text.map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatModelOptionLabel(model)}
                      </option>
                    ))}
                  </select>
                  {!settings.preferences.text_model_valid && settings.preferences.text_model_id && (
                    <p className="text-xs text-destructive">Your saved text model is no longer available. Choose a new one.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Default Vision Summary Model</Label>
                  <select
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    value={visionModelId}
                    onChange={(event) => onVisionModelIdChange(event.target.value)}
                  >
                    <option value="">Choose a vision model</option>
                    {settings.models.vision.map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatModelOptionLabel(model)}
                      </option>
                    ))}
                  </select>
                  {!settings.preferences.vision_model_valid && settings.preferences.vision_model_id && (
                    <p className="text-xs text-destructive">Your saved vision model is no longer available. Choose a new one.</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Summary Prompt</Label>
                <Textarea
                  value={summaryPrompt}
                  onChange={(event) => onSummaryPromptChange(event.target.value)}
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
                      onClick={onResetSummaryPrompt}
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
                  onClick={onSavePreferences}
                  disabled={busyState.openRouterSavePrefs || !textModelId || !visionModelId}
                >
                  {busyState.openRouterSavePrefs ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {busyState.openRouterSavePrefs ? 'Saving...' : 'Save Model Preferences'}
                </Button>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Summary jobs for existing files</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.summary_backfill?.missing_count
                      ? `${settings.summary_backfill.missing_count} files still need a summary.`
                      : 'All existing files already have a summary or are currently being processed.'}
                  </p>
                  {(settings.summary_backfill?.queue_size || 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {settings.summary_backfill?.queue_size} summaries are currently being generated in the background.
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
                      onClick={onBackfill}
                      disabled={busyState.openRouterBackfill || !settings.summary_backfill?.missing_count}
                    >
                      {busyState.openRouterBackfill ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      {busyState.openRouterBackfill ? 'Queueing...' : 'Generate All Missing Summaries'}
                    </Button>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {settings.summary_backfill?.batches?.missing?.active
                          ? `${settings.summary_backfill.batches.missing.completed}/${settings.summary_backfill.batches.missing.total}`
                          : `${0}/${settings.summary_backfill?.missing_count || 0}`}
                      </span>
                      <span>
                        {settings.summary_backfill?.batches?.missing?.active
                          ? `${settings.summary_backfill.batches.missing.progress_percent}%`
                          : 'Ready'}
                      </span>
                    </div>
                    <Progress
                      value={settings.summary_backfill?.batches?.missing?.active
                        ? settings.summary_backfill.batches.missing.progress_percent
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
                      onClick={onRegenerateAll}
                      disabled={busyState.openRouterRegenerateAll || !settings.summary_backfill?.regeneratable_count}
                    >
                      {busyState.openRouterRegenerateAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                      {busyState.openRouterRegenerateAll ? 'Queueing...' : 'Regenerate All Summaries'}
                    </Button>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {settings.summary_backfill?.batches?.regenerate?.active
                          ? `${settings.summary_backfill.batches.regenerate.completed}/${settings.summary_backfill.batches.regenerate.total}`
                          : `${0}/${settings.summary_backfill?.regeneratable_count || 0}`}
                      </span>
                      <span>
                        {settings.summary_backfill?.batches?.regenerate?.active
                          ? `${settings.summary_backfill.batches.regenerate.progress_percent}%`
                          : 'Ready'}
                      </span>
                    </div>
                    <Progress
                      value={settings.summary_backfill?.batches?.regenerate?.active
                        ? settings.summary_backfill.batches.regenerate.progress_percent
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
  );
}

type BrandingSectionProps = {
  workspaceLogoUrl: string | null | undefined;
  workspaceFaviconUrl: string | null | undefined;
  busyState: BusyState;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onFaviconUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onFaviconRemove: () => void;
};

function BrandingSection({
  workspaceLogoUrl,
  workspaceFaviconUrl,
  busyState,
  onLogoUpload,
  onLogoRemove,
  onFaviconUpload,
  onFaviconRemove,
}: BrandingSectionProps) {
  return (
    <Section>
      <h3 className="text-sm font-semibold">Workspace Logo</h3>
      <div className="flex items-center gap-4">
        {workspaceLogoUrl ? (
          <img src={workspaceLogoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-5 h-5" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" accept={SAFE_LOGO_UPLOAD_ACCEPT} onChange={onLogoUpload} className="hidden" id="logo-upload" />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => document.getElementById('logo-upload')?.click()} disabled={busyState.logoUpload}>
            {busyState.logoUpload ? 'Uploading...' : 'Upload Logo'}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onLogoRemove} disabled={!workspaceLogoUrl || busyState.logoRemove}>
            {busyState.logoRemove ? 'Removing...' : 'Remove Logo'}
          </Button>
        </div>
      </div>
      <div className="pt-2 border-t border-border/60 flex items-center gap-4">
        {workspaceFaviconUrl ? (
          <img src={workspaceFaviconUrl} alt="Favicon" className="w-8 h-8 rounded object-cover border border-border" />
        ) : (
          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-4 h-4" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" accept={SAFE_FAVICON_UPLOAD_ACCEPT} onChange={onFaviconUpload} className="hidden" id="favicon-upload" />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => document.getElementById('favicon-upload')?.click()} disabled={busyState.faviconUpload}>
            {busyState.faviconUpload ? 'Uploading...' : 'Upload Favicon'}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onFaviconRemove} disabled={!workspaceFaviconUrl || busyState.faviconRemove}>
            {busyState.faviconRemove ? 'Removing...' : 'Remove Favicon'}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { settings: localSettings, update: updateLocalSettings } = useLocalSettings();
  const { user, profile, refreshProfile, isAdmin, signOut, appSettings, refreshSettings } = useAuth();
  const userId = user?.id ?? null;

  const [busyState, setBusyState] = useState<BusyState>(INITIAL_BUSY_STATE);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [trashRetentionDays, setTrashRetentionDays] = useState(String(appSettings.trash_retention_days || 30));
  const [openRouterSettings, setOpenRouterSettings] = useState<api.OpenRouterSettings | null>(null);
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [textModelId, setTextModelId] = useState('');
  const [visionModelId, setVisionModelId] = useState('');
  const [summaryPrompt, setSummaryPrompt] = useState('');

  const runBusyAction = useCallback(async <T,>(key: BusyKey, action: () => Promise<T>): Promise<T> => {
    setBusyState((current) => ({ ...current, [key]: true }));
    try {
      return await action();
    } finally {
      setBusyState((current) => ({ ...current, [key]: false }));
    }
  }, []);

  const loadOpenRouterSettings = useCallback(async (showError = true) => {
    try {
      const settings = await api.getOpenRouterSettings();
      setOpenRouterSettings(settings);
      return settings;
    } catch (error) {
      if (showError) {
        toast.error(getErrorMessage(error, 'Failed to load AI settings'));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    setNewEmail(user?.email ?? '');
  }, [user?.email]);

  useEffect(() => {
    setDisplayName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  useEffect(() => {
    setTrashRetentionDays(String(appSettings.trash_retention_days || 30));
  }, [appSettings.trash_retention_days]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    api.getSettings()
      .then((settings) => {
        if (!cancelled) {
          setRegistrationEnabled(settings.registration_enabled);
          setTrashRetentionDays(String(settings.trash_retention_days));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!userId) {
      setOpenRouterSettings(null);
      setOpenRouterLoading(false);
      return;
    }

    let cancelled = false;
    setOpenRouterLoading(true);
    api.getOpenRouterSettings()
      .then((settings) => {
        if (!cancelled) {
          setOpenRouterSettings(settings);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Failed to load AI settings'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOpenRouterLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

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
  const hasCustomSummaryPrompt = useMemo(
    () => summaryPrompt.trim() !== summaryPromptDefault.trim(),
    [summaryPrompt, summaryPromptDefault],
  );
  const credentialIndicator = useMemo(
    () => getOpenRouterCredentialIndicator(openRouterSettings),
    [openRouterSettings],
  );
  const shouldPollOpenRouterSettings = hasActiveOpenRouterBatch(openRouterSettings);

  useEffect(() => {
    if (!userId || !shouldPollOpenRouterSettings) return undefined;

    const intervalId = window.setInterval(() => {
      void loadOpenRouterSettings(false);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [loadOpenRouterSettings, shouldPollOpenRouterSettings, userId]);

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(PASSWORD_MIN_LENGTH_MESSAGE);
      return;
    }

    try {
      await runBusyAction('password', async () => {
        await api.updatePassword(newPassword);
        toast.success('Password updated. Please sign in again.');
        setNewPassword('');
        window.setTimeout(() => {
          void signOut();
        }, 1500);
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update password'));
    }
  };

  const handleEmailChange = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Email is required');
      return;
    }
    if (normalizedEmail === user?.email) {
      toast.message('Email is already up to date');
      return;
    }

    try {
      await runBusyAction('email', async () => {
        await api.updateEmail(normalizedEmail);
        await refreshProfile();
        toast.success('Email updated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update email'));
    }
  };

  const handleDisplayNameChange = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      toast.error('Display name is required');
      return;
    }
    if (trimmedDisplayName === (profile?.full_name || '').trim()) {
      toast.message('Display name is already up to date');
      return;
    }

    try {
      await runBusyAction('displayName', async () => {
        await api.updateProfile({ fullName: trimmedDisplayName });
        await refreshProfile();
        toast.success('Display name updated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update display name'));
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId || !isAdmin) return;

    try {
      await runBusyAction('logoUpload', async () => {
        await api.uploadLogo(file);
        await refreshSettings();
        toast.success('Logo updated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload logo'));
    }
  };

  const handleAccentChange = async (color: string) => {
    if (!userId) return;

    try {
      await api.updateProfile({ accentColor: color });
      await refreshProfile();
      toast.success('Accent color updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update accent color'));
    }
  };

  const handleLogoRemove = async () => {
    if (!userId || !isAdmin) return;

    try {
      await runBusyAction('logoRemove', async () => {
        await api.removeLogo();
        await refreshSettings();
        toast.success('Logo removed');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove logo'));
    }
  };

  const handleFaviconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId || !isAdmin) return;

    try {
      await runBusyAction('faviconUpload', async () => {
        await api.uploadFavicon(file);
        await refreshSettings();
        toast.success('Favicon updated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload favicon'));
    }
  };

  const handleFaviconRemove = async () => {
    if (!userId || !isAdmin) return;

    try {
      await runBusyAction('faviconRemove', async () => {
        await api.removeFavicon();
        await refreshSettings();
        toast.success('Favicon removed');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove favicon'));
    }
  };

  const handleRegistrationToggle = async (enabled: boolean) => {
    const previousValue = registrationEnabled;
    setRegistrationEnabled(enabled);

    try {
      await api.updateSettings({ registration_enabled: enabled });
      toast.success(enabled ? 'Registration enabled' : 'Registration disabled');
    } catch (error) {
      setRegistrationEnabled(previousValue);
      toast.error(getErrorMessage(error, 'Failed to update setting'));
    }
  };

  const handleTrashRetentionSave = async (event: FormEvent) => {
    event.preventDefault();

    const trimmed = trashRetentionDays.trim();
    if (!/^\d+$/.test(trimmed)) {
      toast.error('Trash retention must be a whole number of at least 1 day');
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error('Trash retention must be a whole number of at least 1 day');
      return;
    }

    try {
      await runBusyAction('trashRetention', async () => {
        await api.updateSettings({ trash_retention_days: parsed });
        await refreshSettings();
        setTrashRetentionDays(String(parsed));
        toast.success('Trash retention updated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update trash retention'));
    }
  };

  const handleOpenRouterKeySave = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedKey = openRouterKey.trim();
    if (!trimmedKey) {
      toast.error('Paste your OpenRouter API key first');
      return;
    }

    try {
      await runBusyAction('openRouterSaveKey', async () => {
        const settings = await api.saveOpenRouterKey(trimmedKey);
        setOpenRouterSettings(settings);
        setOpenRouterKey('');
        toast.success('OpenRouter key validated');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to validate the OpenRouter key'));
    }
  };

  const handleOpenRouterRefreshModels = async () => {
    try {
      await runBusyAction('openRouterRefreshModels', async () => {
        const settings = await api.refreshOpenRouterModels();
        setOpenRouterSettings(settings);
        toast.success('Model list refreshed');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to refresh models'));
    }
  };

  const handleOpenRouterRemoveKey = async () => {
    try {
      await runBusyAction('openRouterRemoveKey', async () => {
        await api.removeOpenRouterKey();
        setOpenRouterSettings(createEmptyOpenRouterSettings(summaryPrompt, summaryPromptDefault));
        setTextModelId('');
        setVisionModelId('');
        toast.success('OpenRouter key removed');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove the OpenRouter key'));
    }
  };

  const handleOpenRouterPreferenceSave = async () => {
    if (!textModelId || !visionModelId) {
      toast.error('Choose both a text model and a vision model');
      return;
    }

    try {
      await runBusyAction('openRouterSavePrefs', async () => {
        const settings = await api.saveOpenRouterPreferences({
          textModelId,
          visionModelId,
          summaryPrompt,
        });
        setOpenRouterSettings(settings);
        toast.success('AI model preferences saved');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save AI model preferences'));
    }
  };

  const handleOpenRouterBackfill = async () => {
    try {
      await runBusyAction('openRouterBackfill', async () => {
        const response = await api.queueMissingOpenRouterSummaries();
        setOpenRouterSettings(response.settings);
        toast.success(response.queued > 0 ? `Queued ${response.queued} summaries` : 'No files are currently missing summaries');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to queue missing summaries'));
    }
  };

  const handleOpenRouterRegenerateAll = async () => {
    try {
      await runBusyAction('openRouterRegenerateAll', async () => {
        const response = await api.regenerateAllOpenRouterSummaries();
        setOpenRouterSettings(response.settings);
        toast.success(response.queued > 0 ? `Queued ${response.queued} summaries for regeneration` : 'No documents are currently ready to regenerate');
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to queue summary regeneration'));
    }
  };

  return (
    <div className="max-w-2xl space-y-5 animate-page-in">
      <h2 className="text-xl font-semibold tracking-tight">Settings</h2>

      <Section>
        <h3 className="text-sm font-semibold">Display Name</h3>
        <form onSubmit={handleDisplayNameChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Enter your display name" required className="h-10 rounded-lg" />
          </div>
          <Button type="submit" size="sm" className="rounded-lg" disabled={busyState.displayName}>
            {busyState.displayName ? 'Updating...' : 'Update Name'}
          </Button>
        </form>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section>
          <h3 className="text-sm font-semibold">Change Email</h3>
          <form onSubmit={handleEmailChange} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New Email</Label>
              <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Enter new email" required className="h-10 rounded-lg" />
            </div>
            <p className="text-xs text-muted-foreground">
              You can update your email easily from this setting.
            </p>
            <Button type="submit" size="sm" className="rounded-lg" disabled={busyState.email}>
              {busyState.email ? 'Updating...' : 'Update Email'}
            </Button>
          </form>
        </Section>

        <Section>
          <h3 className="text-sm font-semibold">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New Password</Label>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Enter new password" required minLength={PASSWORD_MIN_LENGTH} className="h-10 rounded-lg" />
            </div>
            <p className="text-xs text-muted-foreground">You will be signed out after changing your password.</p>
            <Button type="submit" size="sm" className="rounded-lg" disabled={busyState.password}>
              {busyState.password ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Section>
      </div>

      <OpenRouterSection
        loading={openRouterLoading}
        settings={openRouterSettings}
        openRouterKey={openRouterKey}
        textModelId={textModelId}
        visionModelId={visionModelId}
        summaryPrompt={summaryPrompt}
        summaryPromptDefault={summaryPromptDefault}
        hasCustomSummaryPrompt={hasCustomSummaryPrompt}
        credentialIndicator={credentialIndicator}
        busyState={busyState}
        onOpenRouterKeyChange={setOpenRouterKey}
        onTextModelIdChange={setTextModelId}
        onVisionModelIdChange={setVisionModelId}
        onSummaryPromptChange={setSummaryPrompt}
        onResetSummaryPrompt={() => setSummaryPrompt(summaryPromptDefault)}
        onSaveKey={handleOpenRouterKeySave}
        onRefreshModels={handleOpenRouterRefreshModels}
        onRemoveKey={handleOpenRouterRemoveKey}
        onSavePreferences={handleOpenRouterPreferenceSave}
        onBackfill={handleOpenRouterBackfill}
        onRegenerateAll={handleOpenRouterRegenerateAll}
      />

      {isAdmin && (
        <>
          <Section>
            <h3 className="text-sm font-semibold">Access Control</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex h-full items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Allow new user registration</p>
                  <p className="text-xs text-muted-foreground">When disabled, only admins can create users from the Admin page.</p>
                </div>
                <Switch checked={registrationEnabled} onCheckedChange={handleRegistrationToggle} aria-label="Toggle registration" />
              </div>

              <form onSubmit={handleTrashRetentionSave} className="flex h-full flex-col justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="trash-retention-days" className="text-sm font-medium text-foreground">Trash retention (days)</Label>
                  <p className="text-xs text-muted-foreground">Documents in Trash are permanently deleted after this many days.</p>
                  <Input
                    id="trash-retention-days"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={trashRetentionDays}
                    onChange={(event) => setTrashRetentionDays(event.target.value)}
                    className="h-10 max-w-40 rounded-lg"
                  />
                </div>
                <Button type="submit" size="sm" className="w-fit rounded-lg" disabled={busyState.trashRetention}>
                  {busyState.trashRetention ? 'Saving...' : 'Save Retention'}
                </Button>
              </form>
            </div>
          </Section>

          <BrandingSection
            workspaceLogoUrl={appSettings.workspace_logo_url}
            workspaceFaviconUrl={appSettings.workspace_favicon_url}
            busyState={busyState}
            onLogoUpload={handleLogoUpload}
            onLogoRemove={handleLogoRemove}
            onFaviconUpload={handleFaviconUpload}
            onFaviconRemove={handleFaviconRemove}
          />
        </>
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
            onCheckedChange={(thumbnailPreviews) => updateLocalSettings({ thumbnailPreviews })}
            aria-label="Toggle thumbnail previews"
          />
        </div>
      </Section>

      <Section>
        <h3 className="text-sm font-semibold">Accent Color</h3>
        <div className="flex gap-2.5">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleAccentChange(color)}
              className="w-8 h-8 rounded-full border-2 transition-all duration-150 hover:scale-110 active:scale-95"
              style={{ backgroundColor: color, borderColor: profile?.accent_color === color ? 'hsl(var(--foreground))' : 'transparent' }}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
