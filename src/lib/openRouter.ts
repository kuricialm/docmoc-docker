import type { OpenRouterModelOption, OpenRouterSettings } from '@/lib/api';

type CredentialIndicator = {
  label: string;
  dotClassName: string;
};

export function formatModelPricing(model: OpenRouterModelOption): string {
  const parts = [];
  if (typeof model.prompt_price === 'number') parts.push(`Prompt ${model.prompt_price.toFixed(6)}`);
  if (typeof model.completion_price === 'number') parts.push(`Completion ${model.completion_price.toFixed(6)}`);
  return parts.join(' • ');
}

export function formatModelOptionLabel(model: OpenRouterModelOption): string {
  const metadata = [
    model.id,
    model.context_length > 0 ? `${model.context_length.toLocaleString()} ctx` : null,
    formatModelPricing(model) || null,
  ].filter(Boolean);

  return `${model.name}${metadata.length ? ` — ${metadata.join(' • ')}` : ''}`;
}

export function getOpenRouterCredentialIndicator(settings: OpenRouterSettings | null): CredentialIndicator {
  if (!settings?.configured) {
    return {
      label: 'No OpenRouter key configured',
      dotClassName: 'bg-slate-400 ring-slate-300/70',
    };
  }

  if (settings.credential?.status === 'valid' && !settings.credential?.last_error) {
    return {
      label: 'OpenRouter key connected and validated',
      dotClassName: 'bg-emerald-500 ring-emerald-400/60 animate-pulse',
    };
  }

  return {
    label: 'Saved OpenRouter key needs revalidation',
    dotClassName: 'bg-rose-500 ring-rose-400/60 animate-pulse',
  };
}

export function hasActiveOpenRouterBatch(settings: OpenRouterSettings | null): boolean {
  return Boolean(
    settings?.summary_backfill?.batches?.missing?.active
    || settings?.summary_backfill?.batches?.regenerate?.active
    || settings?.summary_backfill?.queue_size,
  );
}

export function createEmptyOpenRouterSettings(summaryPrompt: string, summaryPromptDefault: string): OpenRouterSettings {
  return {
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
  };
}
