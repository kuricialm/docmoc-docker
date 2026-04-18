import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, History, Plus, Share2, Sparkles, Star, UserX, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentHistory, useDocumentMutations, type Document } from '@/hooks/useDocuments';
import { useDocumentNote, useNoteMutations } from '@/hooks/useNotes';
import { useDocumentSummary } from '@/hooks/useDocumentSummary';
import { useTags, useTagMutations } from '@/hooks/useTags';
import * as api from '@/lib/api';
import { formatDateTime, toLocalDateInputValue, toLocalTimeInputValue } from '@/lib/dateTime';
import { getDocumentHistoryLabel } from '@/lib/documentHistory';
import { decodeDocumentPreviewText } from '@/lib/documentPreviewText';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import { getUploadedByLabel } from '@/lib/documentMeta';
import { copyTextToClipboard, getSharedDocumentUrl } from '@/lib/share';
import { hasArabicCharacters } from '@/lib/text';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DocumentPreview from './DocumentPreview';
import DocumentSummaryCard from './DocumentSummaryCard';

type Props = {
  document: Document | null;
  open: boolean;
  onClose: () => void;
};

const EMPTY_TAGS: NonNullable<Document['tags']> = [];

type DocumentQuickActionsProps = {
  isShared: boolean;
  hasShareUrl: boolean;
  summaryState: api.DocumentSummaryState | null;
  isGeneratingSummary: boolean;
  onDownload: () => void;
  onGenerateSummary: () => void;
  onOpenShareSettings: () => void;
  onDisableSharing: () => void;
  onCopyLink: () => void;
};

function DocumentQuickActions({
  isShared,
  hasShareUrl,
  summaryState,
  isGeneratingSummary,
  onDownload,
  onGenerateSummary,
  onOpenShareSettings,
  onDisableSharing,
  onCopyLink,
}: DocumentQuickActionsProps) {
  const summaryActionLabel = summaryState?.state === 'pending'
    ? 'Summary generation is already running'
    : summaryState?.can_generate === false && summaryState?.message
      ? summaryState.message
    : summaryState?.state === 'ready'
      ? 'Regenerate summary'
      : 'Summarize document';

  return (
    <div className="p-4 sm:p-5 space-y-3 border-b border-border/30">
      <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Quick Actions</h3>
      <div className="flex items-center gap-2 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-lg border-border/40" onClick={onDownload} aria-label="Download">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg border-border/40"
                onClick={onGenerateSummary}
                aria-label={summaryState?.state === 'ready' ? 'Regenerate summary' : 'Summarize document'}
                disabled={isGeneratingSummary || summaryState?.state === 'pending' || summaryState?.can_generate === false}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{summaryActionLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg border-border/40"
                onClick={onOpenShareSettings}
                aria-label={isShared ? 'Edit share settings' : 'Share link'}
              >
                <Share2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isShared ? 'Edit share settings' : 'Share link'}</TooltipContent>
          </Tooltip>
          {isShared && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-lg border-border/40" onClick={onDisableSharing} aria-label="Disable sharing">
                  <UserX className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Disable sharing</TooltipContent>
            </Tooltip>
          )}
          {hasShareUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground rounded-lg" onClick={onCopyLink} aria-label="Copy share link">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy link</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}

type DocumentDetailsTabProps = {
  document: Document;
  optimisticTags: Document['tags'];
  availableTags: NonNullable<Document['tags']>;
  uploadedByLabel: string;
  summaryState: api.DocumentSummaryState | null;
  isSummaryLoading: boolean;
  isGeneratingSummary: boolean;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onGenerateSummary: (force?: boolean) => void;
};

function DocumentDetailsTab({
  document,
  optimisticTags,
  availableTags,
  uploadedByLabel,
  summaryState,
  isSummaryLoading,
  isGeneratingSummary,
  onAddTag,
  onRemoveTag,
  onGenerateSummary,
}: DocumentDetailsTabProps) {
  const typeInfo = getFileTypeInfo(document.file_type);

  return (
    <TabsContent value="details" className="px-4 sm:px-5 pb-5 pt-4 mt-0 space-y-5 overflow-y-auto">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Type</span><span className="font-medium px-1.5 py-0.5 rounded-md text-xs" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>{typeInfo.label}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Size</span><span>{formatFileSize(document.file_size)}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Uploaded by</span><span className="text-right">{uploadedByLabel}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Uploaded at</span><span className="text-right">{formatDateTime(document.created_at) ?? document.created_at}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Modified at</span><span className="text-right">{formatDateTime(document.updated_at) ?? document.updated_at}</span></div>
      </div>

      <div className="space-y-2.5">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Tags</h3>
        <div className="flex flex-wrap gap-1.5 items-center">
          {optimisticTags?.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full font-medium transition-all duration-150 hover:shadow-sm" style={{ backgroundColor: `${tag.color}18`, color: tag.color }}>
              {tag.name}
              <button type="button" onClick={() => onRemoveTag(tag.id)} className="p-0.5 rounded-full hover:bg-black/10 transition-colors duration-150"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          {availableTags.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/20 flex items-center justify-center hover:border-primary hover:text-primary transition-all duration-150"><Plus className="w-3 h-3" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5" align="start">
                {availableTags.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => onAddTag(tag.id)} className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm hover:bg-secondary transition-colors duration-150">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <DocumentSummaryCard
        summaryState={summaryState}
        isLoading={isSummaryLoading}
        isGenerating={isGeneratingSummary}
        onGenerate={onGenerateSummary}
      />
    </TabsContent>
  );
}

type DocumentHistoryTabProps = {
  history: api.DocumentHistoryRecord[];
  isLoading: boolean;
  hasError: boolean;
};

function DocumentHistoryTab({ history, isLoading, hasError }: DocumentHistoryTabProps) {
  return (
    <TabsContent value="history" className="px-4 sm:px-5 pb-5 pt-4 mt-0 overflow-y-auto">
      <div className="space-y-2">
        {isLoading && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading audit events…</div>
        )}
        {hasError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load audit events.
          </div>
        )}
        {!isLoading && !hasError && history.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No audit events yet.</div>
        )}
        {!isLoading && !hasError && history.map((event) => (
          <div key={event.id} className="rounded-xl border border-border/50 bg-background/80 p-3">
            <div className="flex items-start gap-2">
              <History className="w-3.5 h-3.5 mt-0.5 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{getDocumentHistoryLabel(event.action, event.details)}</p>
                <p className="text-xs text-muted-foreground mt-1">{event.actor_name} • {formatDateTime(event.created_at) ?? event.created_at}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}

type ShareDialogProps = {
  open: boolean;
  isShared: boolean;
  expiryEnabled: boolean;
  expiryDate: string;
  expiryTime: string;
  sharePassword: string;
  onOpenChange: (open: boolean) => void;
  onExpiryEnabledChange: (enabled: boolean) => void;
  onExpiryDateChange: (value: string) => void;
  onExpiryTimeChange: (value: string) => void;
  onSharePasswordChange: (value: string) => void;
  onSubmit: () => void;
};

function ShareDialog({
  open,
  isShared,
  expiryEnabled,
  expiryDate,
  expiryTime,
  sharePassword,
  onOpenChange,
  onExpiryEnabledChange,
  onExpiryDateChange,
  onExpiryTimeChange,
  onSharePasswordChange,
  onSubmit,
}: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isShared ? 'Edit share settings' : 'Share this document'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              A share link is public by default. Add expiration, password, or both for extra control.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="share-expiry-enabled">Auto-disable link</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Turn off to keep the link active until you disable sharing.</p>
                </div>
                <Switch id="share-expiry-enabled" checked={expiryEnabled} onCheckedChange={onExpiryEnabledChange} />
              </div>
              {expiryEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="share-expires-date">Date</Label>
                    <Input id="share-expires-date" type="date" value={expiryDate} onChange={(event) => onExpiryDateChange(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="share-expires-time">Time</Label>
                    <Input id="share-expires-time" type="time" step={300} value={expiryTime} onChange={(event) => onExpiryTimeChange(event.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border/50 p-3">
              <Label htmlFor="share-password">Password protect</Label>
              <Input
                id="share-password"
                type="password"
                value={sharePassword}
                onChange={(event) => onSharePasswordChange(event.target.value)}
                placeholder="Leave blank for no password"
                minLength={4}
              />
            </div>
          </div>

          <Button className="w-full h-10" onClick={onSubmit}>{isShared ? 'Update share settings' : 'Generate link'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useDocumentPreviewState(document: Document | null, open: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textIsArabic, setTextIsArabic] = useState(false);
  const documentId = document?.id ?? null;
  const fileType = document?.file_type ?? null;

  useEffect(() => {
    if (!documentId || !fileType || !open) {
      setPreviewUrl(null);
      setTextContent(null);
      setTextIsArabic(false);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      if (fileType === 'text/plain') {
        const blob = await api.getDocumentBlob(documentId);
        if (!blob || cancelled) return;

        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;

        const { content, isArabic } = decodeDocumentPreviewText(bytes);
        setTextContent(content);
        setTextIsArabic(isArabic);
        setPreviewUrl(null);
        return;
      }

      if (fileType === 'application/pdf' || isImageType(fileType)) {
        setPreviewUrl(api.getDocumentFileUrl(documentId));
        setTextContent(null);
        setTextIsArabic(false);
        return;
      }

      setPreviewUrl(null);
      setTextContent(null);
      setTextIsArabic(false);
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [documentId, fileType, open]);

  return {
    previewUrl,
    textContent,
    textIsArabic,
  };
}

function useDocumentShareState(document: Document | null, open: boolean) {
  const generatedTokenRef = useRef<string | null>(null);
  const [optimisticShared, setOptimisticShared] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('23:59');
  const [sharePassword, setSharePassword] = useState('');
  const documentId = document?.id ?? null;
  const documentShared = document?.shared ?? false;
  const shareToken = document?.share_token ?? null;
  const shareExpiresAt = document?.share_expires_at ?? null;

  useEffect(() => {
    if (!documentId) return;

    setOptimisticShared(documentShared);

    if (shareToken && !generatedTokenRef.current) {
      generatedTokenRef.current = shareToken;
    }

    if (shareExpiresAt) {
      const expiry = new Date(shareExpiresAt);
      setExpiryEnabled(true);
      setExpiryDate(toLocalDateInputValue(expiry));
      setExpiryTime(toLocalTimeInputValue(expiry));
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setExpiryEnabled(false);
      setExpiryDate(toLocalDateInputValue(tomorrow));
      setExpiryTime('23:59');
    }

    setSharePassword('');
  }, [documentId, documentShared, shareExpiresAt, shareToken]);

  useEffect(() => {
    if (!open) {
      generatedTokenRef.current = null;
    }
  }, [open]);

  const resolveShareUrl = useCallback(() => {
    const token = generatedTokenRef.current || shareToken;
    return token ? getSharedDocumentUrl(token) : null;
  }, [shareToken]);

  const openShareSettings = useCallback(() => {
    if (!shareExpiresAt && !expiryDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setExpiryDate(toLocalDateInputValue(tomorrow));
      setExpiryTime('23:59');
    }

    setSharePassword('');
    setShareDialogOpen(true);
  }, [expiryDate, shareExpiresAt]);

  const storeGeneratedToken = useCallback((token: string | null) => {
    generatedTokenRef.current = token;
  }, []);

  const restoreShareState = useCallback(() => {
    setOptimisticShared(documentShared);
    generatedTokenRef.current = shareToken;
  }, [documentShared, shareToken]);

  return {
    optimisticShared,
    setOptimisticShared,
    shareDialogOpen,
    setShareDialogOpen,
    expiryEnabled,
    setExpiryEnabled,
    expiryDate,
    setExpiryDate,
    expiryTime,
    setExpiryTime,
    sharePassword,
    setSharePassword,
    resolveShareUrl,
    openShareSettings,
    storeGeneratedToken,
    restoreShareState,
  };
}

export default function DocumentViewer({ document, open, onClose }: Props) {
  const { profile } = useAuth();
  const { previewUrl, textContent, textIsArabic } = useDocumentPreviewState(document, open);
  const {
    optimisticShared,
    setOptimisticShared,
    shareDialogOpen,
    setShareDialogOpen,
    expiryEnabled,
    setExpiryEnabled,
    expiryDate,
    setExpiryDate,
    expiryTime,
    setExpiryTime,
    sharePassword,
    setSharePassword,
    resolveShareUrl,
    openShareSettings,
    storeGeneratedToken,
    restoreShareState,
  } = useDocumentShareState(document, open);
  const [noteText, setNoteText] = useState('');
  const [optimisticStarred, setOptimisticStarred] = useState(false);
  const [optimisticTags, setOptimisticTags] = useState<Document['tags']>([]);

  const { data: note } = useDocumentNote(document?.id);
  const { data: history = [], isLoading: isHistoryLoading, error: historyError } = useDocumentHistory(document?.id);
  const { summaryQuery, generateSummary } = useDocumentSummary(document?.id);
  const { upsertNote } = useNoteMutations();
  const { downloadDocument, toggleShare, toggleStar } = useDocumentMutations();
  const { data: allTags = [] } = useTags();
  const { addTagToDocument, removeTagFromDocument } = useTagMutations();
  const documentId = document?.id ?? null;
  const documentStarred = document?.starred ?? false;
  const documentUpdatedAt = document?.updated_at ?? null;
  const documentTags = document?.tags ?? EMPTY_TAGS;

  useEffect(() => {
    setNoteText(note?.content || '');
  }, [note]);

  useEffect(() => {
    if (!documentId) return;
    setOptimisticStarred(documentStarred);
    setOptimisticTags(documentTags);
  }, [documentId, documentStarred, documentTags, documentUpdatedAt]);

  const summaryState = summaryQuery.data ?? null;

  const availableTags = useMemo(() => {
    const tagIds = new Set((optimisticTags || []).map((tag) => tag.id));
    return allTags.filter((tag) => !tagIds.has(tag.id));
  }, [allTags, optimisticTags]);

  const hasShareUrl = Boolean(resolveShareUrl());

  if (!document) return null;

  const uploadedByLabel = getUploadedByLabel(document.uploaded_by_name, profile?.full_name, profile?.email);

  const handleGenerateSummary = (force = false) => {
    if (summaryState?.state === 'pending') {
      toast.message(summaryState.message || 'Summary generation is already running');
      return;
    }
    if (summaryState?.state === 'no_key' || summaryState?.state === 'key_invalid' || summaryState?.state === 'model_missing') {
      toast.error(summaryState.message || 'OpenRouter setup is required in Settings');
      return;
    }
    if (summaryState?.can_generate === false) {
      toast.error(summaryState.message || 'Summary generation is not available right now');
      return;
    }
    if (summaryState?.state === 'unsupported' && !force) {
      toast.error(summaryState.message || 'This document cannot be summarized yet');
      return;
    }

    generateSummary.mutate({ force });
  };

  const handleSaveNote = () => {
    upsertNote.mutate(
      { documentId: document.id, content: noteText },
      {
        onSuccess: () => {
          toast.success('Note saved');
        },
      },
    );
  };

  const handleCopyLink = async () => {
    const url = resolveShareUrl();
    if (!url) {
      toast.error('No share link available');
      return;
    }

    try {
      await copyTextToClipboard(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleToggleStar = () => {
    const nextStarred = !optimisticStarred;
    setOptimisticStarred(nextStarred);
    toggleStar.mutate({ id: document.id, starred: nextStarred }, { onError: () => setOptimisticStarred(!nextStarred) });
  };

  const handleAddTag = (tagId: string) => {
    const tagToAdd = allTags.find((tag) => tag.id === tagId);
    if (!tagToAdd) return;

    setOptimisticTags((current) => [...(current || []), tagToAdd]);
    addTagToDocument.mutate(
      { documentId: document.id, tagId: tagToAdd.id },
      {
        onError: () => {
          setOptimisticTags((current) => (current || []).filter((tag) => tag.id !== tagToAdd.id));
        },
      },
    );
  };

  const handleRemoveTag = (tagId: string) => {
    const removedTag = optimisticTags?.find((tag) => tag.id === tagId);
    if (!removedTag) return;

    setOptimisticTags((current) => (current || []).filter((tag) => tag.id !== tagId));
    removeTagFromDocument.mutate(
      { documentId: document.id, tagId },
      {
        onError: () => {
          setOptimisticTags((current) => [...(current || []), removedTag]);
        },
      },
    );
  };

  const handleDisableSharing = () => {
    setOptimisticShared(false);
    storeGeneratedToken(null);
    toggleShare.mutate(
      { id: document.id, shared: false },
      {
        onError: restoreShareState,
      },
    );
  };

  const handleGenerateShareLink = async () => {
    if (sharePassword && sharePassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    const resolvedExpiry = expiryEnabled && expiryDate
      ? new Date(`${expiryDate}T${expiryTime || '23:59'}`).toISOString()
      : undefined;

    setOptimisticShared(true);
    toggleShare.mutate(
      {
        id: document.id,
        shared: true,
        config: {
          expiresAt: resolvedExpiry,
          password: sharePassword || undefined,
        },
      },
      {
        onSuccess: async (data) => {
          const token = data?.share_token ?? null;
          setOptimisticShared(true);
          setShareDialogOpen(false);

          if (!token) {
            toast.error('Share enabled but no token returned');
            return;
          }

          storeGeneratedToken(token);
          const shareUrl = getSharedDocumentUrl(token);
          try {
            await copyTextToClipboard(shareUrl);
            toast.success('Share link generated & copied');
          } catch {
            toast.success('Share link generated');
          }
        },
        onError: restoreShareState,
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent className="w-[96vw] max-w-5xl h-[95vh] sm:h-[82vh] flex flex-col p-0 gap-0 rounded-xl border-border/50 shadow-xl">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleToggleStar} className="p-1.5 rounded-lg hover:bg-secondary transition-all duration-150" aria-label={optimisticStarred ? 'Unstar document' : 'Star document'}>
                <Star className={`w-4 h-4 transition-colors duration-150 ${optimisticStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
              <DialogTitle className={`text-base font-semibold truncate flex-1 ${hasArabicCharacters(document.name) ? 'font-arabic-text' : ''}`}>
                {document.name}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 min-h-[220px] lg:min-h-0 bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center overflow-auto p-3 sm:p-5">
              <DocumentPreview
                fileType={document.file_type}
                fileName={document.name}
                previewUrl={previewUrl}
                textContent={textContent}
                textIsArabic={textIsArabic}
                className="h-full w-full"
                imageClassName="max-w-full max-h-full object-contain"
                iframeClassName="h-full"
                onDownload={() => downloadDocument(document.id, document.name)}
              />
            </div>

            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border/40 flex flex-col overflow-y-auto bg-card/30">
              <DocumentQuickActions
                isShared={optimisticShared}
                hasShareUrl={hasShareUrl}
                summaryState={summaryState}
                isGeneratingSummary={generateSummary.isPending}
                onDownload={() => downloadDocument(document.id, document.name)}
                onGenerateSummary={() => handleGenerateSummary(summaryState?.state === 'ready' || summaryState?.state === 'failed')}
                onOpenShareSettings={openShareSettings}
                onDisableSharing={handleDisableSharing}
                onCopyLink={handleCopyLink}
              />

              <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 sm:px-5 pt-3">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                </div>

                <DocumentDetailsTab
                  document={document}
                  optimisticTags={optimisticTags}
                  availableTags={availableTags}
                  uploadedByLabel={uploadedByLabel}
                  summaryState={summaryState}
                  isSummaryLoading={summaryQuery.isLoading}
                  isGeneratingSummary={generateSummary.isPending}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onGenerateSummary={handleGenerateSummary}
                />

                <TabsContent value="notes" className="px-4 sm:px-5 pb-5 pt-4 mt-0 flex-1 flex flex-col">
                  <Textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add private notes about this document..." className="flex-1 min-h-[160px] resize-none text-sm rounded-lg border-border/40 focus:border-primary/30" />
                  <Button size="sm" className="mt-2.5 self-end rounded-lg" onClick={handleSaveNote}>Save Note</Button>
                </TabsContent>

                <DocumentHistoryTab
                  history={history}
                  isLoading={isHistoryLoading}
                  hasError={Boolean(historyError)}
                />
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareDialogOpen}
        isShared={optimisticShared}
        expiryEnabled={expiryEnabled}
        expiryDate={expiryDate}
        expiryTime={expiryTime}
        sharePassword={sharePassword}
        onOpenChange={setShareDialogOpen}
        onExpiryEnabledChange={setExpiryEnabled}
        onExpiryDateChange={setExpiryDate}
        onExpiryTimeChange={setExpiryTime}
        onSharePasswordChange={setSharePassword}
        onSubmit={handleGenerateShareLink}
      />
    </>
  );
}
