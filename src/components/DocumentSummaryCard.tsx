import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { DocumentSummaryState } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Props = {
  summaryState: DocumentSummaryState | null | undefined;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: (force?: boolean) => void;
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DocumentSummaryCard({
  summaryState,
  isLoading,
  isGenerating,
  onGenerate,
}: Props) {
  const actionButton = summaryState?.state === 'ready'
    ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-md px-2 text-xs"
          onClick={() => onGenerate(true)}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Regenerate
        </Button>
      )
    : summaryState?.state === 'missing'
      ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-xs"
            onClick={() => onGenerate(false)}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Generate Summary
          </Button>
        )
      : summaryState?.state === 'failed'
        ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2 text-xs"
              onClick={() => onGenerate(true)}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Retry
            </Button>
          )
        : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Summary</h3>
        {actionButton}
      </div>

      <div className="rounded-xl border border-border/50 bg-background/70 p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading summary...
          </div>
        ) : isGenerating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating summary...
          </div>
        ) : summaryState?.state === 'pending' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {summaryState.message || 'Generating summary automatically...'}
          </div>
        ) : !summaryState ? (
          <p className="text-sm text-muted-foreground">Summary information is unavailable right now.</p>
        ) : summaryState.state === 'ready' && summaryState.summary ? (
          <div className="space-y-3">
            <div dir="auto" className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
              {summaryState.summary}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {summaryState.model && <p>Model: {summaryState.model}</p>}
              {summaryState.coverage && <p>Coverage: {summaryState.coverage === 'truncated' ? 'Partial document' : 'Full document'}</p>}
              {formatDateTime(summaryState.generated_at) && <p>Generated: {formatDateTime(summaryState.generated_at)}</p>}
            </div>
          </div>
        ) : summaryState.state === 'missing' ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Generate an AI summary for this document using your current prompt.</p>
          </div>
        ) : summaryState.state === 'no_key' || summaryState.state === 'model_missing' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>{summaryState.message}</p>
            </div>
            <Button asChild type="button" size="sm" variant="outline" className="rounded-lg">
              <Link to="/settings">Open Settings</Link>
            </Button>
          </div>
        ) : summaryState.state === 'failed' ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{summaryState.message || 'Summary generation failed.'}</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>{summaryState.message || 'This document cannot be summarized yet.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
