import { useState, useEffect, useRef } from 'react';
import { Document } from '@/hooks/useDocuments';
import { useDocumentNote, useNoteMutations } from '@/hooks/useNotes';
import { useTags, useTagMutations } from '@/hooks/useTags';
import * as api from '@/lib/api';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Download, Share2, Copy, Star, Plus } from 'lucide-react';
import FileTypeIcon from './FileTypeIcon';
import { useDocumentMutations } from '@/hooks/useDocuments';
import { toast } from 'sonner';
import { copyTextToClipboard, getSharedDocumentUrl } from '@/lib/share';

type Props = {
  document: Document | null;
  open: boolean;
  onClose: () => void;
};

export default function DocumentViewer({ document: doc, open, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [optimisticStarred, setOptimisticStarred] = useState(false);
  const [optimisticTags, setOptimisticTags] = useState<Document['tags']>([]);
  const [optimisticShared, setOptimisticShared] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [sharePassword, setSharePassword] = useState('');

  // Ref-based token that survives polling resets — this is the source of truth for copy
  const generatedTokenRef = useRef<string | null>(null);

  const { data: note } = useDocumentNote(doc?.id);
  const { upsertNote } = useNoteMutations();
  const { downloadDocument, toggleShare, toggleStar } = useDocumentMutations();
  const { data: allTags } = useTags();
  const { addTagToDocument, removeTagFromDocument } = useTagMutations();

  const getLocalDateTime = () => {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  // Resolve the best available share URL at call time
  const resolveShareUrl = (): string | null => {
    const token = generatedTokenRef.current || doc?.share_token;
    return token ? getSharedDocumentUrl(token) : null;
  };

  useEffect(() => {
    if (note) setNoteText(note.content);
    else setNoteText('');
  }, [note]);

  useEffect(() => {
    if (!doc || !open) {
      setPreviewUrl(null);
      setTextContent(null);
      return;
    }

    const loadPreview = async () => {
      const blob = await api.getDocumentBlob(doc.id);
      if (!blob) return;
      if (doc.file_type === 'text/plain') {
        setTextContent(await blob.text());
      } else if (doc.file_type === 'application/pdf' || isImageType(doc.file_type)) {
        setPreviewUrl(URL.createObjectURL(blob));
      }
    };
    loadPreview();

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [doc, open]);

  // Sync from doc props — but never overwrite a locally generated token
  useEffect(() => {
    if (!doc) return;
    setOptimisticStarred(doc.starred);
    setOptimisticTags(doc.tags || []);
    setOptimisticShared(doc.shared);

    // Only update the ref from doc if we don't already have a locally generated token
    if (doc.share_token && !generatedTokenRef.current) {
      generatedTokenRef.current = doc.share_token;
    }

    setExpiresAt(doc.share_expires_at ? doc.share_expires_at.slice(0, 16) : '');
    setSharePassword('');
  }, [doc]);

  // Reset generated token ref when modal closes
  useEffect(() => {
    if (!open) {
      generatedTokenRef.current = null;
    }
  }, [open]);

  if (!doc) return null;
  const typeInfo = getFileTypeInfo(doc.file_type);
  const docTagIds = optimisticTags?.map((t) => t.id) || [];
  const availableTags = allTags?.filter((t) => !docTagIds.includes(t.id)) || [];

  const handleSaveNote = () => {
    upsertNote.mutate({ documentId: doc.id, content: noteText });
    toast.success('Note saved');
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
    toggleStar.mutate({ id: doc.id, starred: nextStarred }, { onError: () => setOptimisticStarred(!nextStarred) });
  };

  const handleAddTag = (tagId: string) => {
    const tagToAdd = allTags?.find((tag) => tag.id === tagId);
    if (!tagToAdd) return;
    setOptimisticTags((prev) => [...(prev || []), tagToAdd]);
    addTagToDocument.mutate(
      { documentId: doc.id, tagId: tagToAdd.id },
      { onError: () => setOptimisticTags((prev) => (prev || []).filter((tag) => tag.id !== tagToAdd.id)) },
    );
  };

  const handleRemoveTag = (tagId: string) => {
    const removedTag = optimisticTags?.find((tag) => tag.id === tagId);
    if (!removedTag) return;
    setOptimisticTags((prev) => (prev || []).filter((tag) => tag.id !== tagId));
    removeTagFromDocument.mutate(
      { documentId: doc.id, tagId },
      { onError: () => setOptimisticTags((prev) => [...(prev || []), removedTag]) },
    );
  };

  const handleDisableSharing = () => {
    setOptimisticShared(false);
    generatedTokenRef.current = null;
    toggleShare.mutate(
      { id: doc.id, shared: false },
      {
        onError: () => {
          setOptimisticShared(doc.shared);
          if (doc.share_token) generatedTokenRef.current = doc.share_token;
        },
      },
    );
  };

  const handleGenerateShareLink = async () => {
    if (sharePassword && sharePassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    const config = {
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      password: sharePassword || undefined,
    };

    setOptimisticShared(true);
    toggleShare.mutate(
      { id: doc.id, shared: true, config },
      {
        onSuccess: async (data: { share_token: string | null } | undefined) => {
          const token = data?.share_token ?? null;
          setOptimisticShared(true);
          setShareDialogOpen(false);

          if (token) {
            // Persist in ref so polling can't overwrite it
            generatedTokenRef.current = token;
            const url = getSharedDocumentUrl(token);
            try {
              await copyTextToClipboard(url);
              toast.success('Share link generated & copied');
            } catch {
              toast.success('Share link generated');
            }
          } else {
            toast.error('Share enabled but no token returned');
          }
        },
        onError: () => {
          setOptimisticShared(doc.shared);
          if (doc.share_token) {
            generatedTokenRef.current = doc.share_token;
          } else {
            generatedTokenRef.current = null;
          }
        },
      },
    );
  };

  const openShareSettings = () => {
    setExpiresAt(getLocalDateTime());
    setSharePassword('');
    setShareDialogOpen(true);
  };

  const hasShareUrl = !!resolveShareUrl();

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[96vw] max-w-5xl h-[95vh] sm:h-[82vh] flex flex-col p-0 gap-0 rounded-xl border-border/50 shadow-xl">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={handleToggleStar} className="p-1.5 rounded-lg hover:bg-secondary transition-all duration-150" aria-label={optimisticStarred ? 'Unstar document' : 'Star document'}>
                <Star className={`w-4 h-4 transition-colors duration-150 ${optimisticStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
              <DialogTitle className="text-base font-semibold truncate flex-1">{doc.name}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 min-h-[220px] lg:min-h-0 bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center overflow-auto p-3 sm:p-5">
              {doc.file_type === 'application/pdf' && previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full rounded-lg border border-border/30" title="PDF Preview" />
              ) : doc.file_type === 'text/plain' && textContent !== null ? (
                <pre className="w-full h-full overflow-auto p-4 text-sm font-mono bg-card rounded-lg border border-border/30 whitespace-pre-wrap">{textContent}</pre>
              ) : isImageType(doc.file_type) && previewUrl ? (
                <img src={previewUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <FileTypeIcon fileType={doc.file_type} size="lg" />
                  <p className="text-sm text-muted-foreground">Preview not available for this format</p>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => downloadDocument(doc.id, doc.name)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download to view
                  </Button>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border/40 flex flex-col overflow-y-auto">
              <div className="p-4 sm:p-5 space-y-4 border-b border-border/30">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium px-1.5 py-0.5 rounded-md text-xs" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>{typeInfo.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{formatFileSize(doc.file_size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Uploaded</span><span>{new Date(doc.created_at).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Modified</span><span>{new Date(doc.updated_at).toLocaleDateString()}</span></div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-2.5 border-b border-border/30">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Tags</h3>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {optimisticTags?.map((tag) => (
                    <span key={tag.id} className="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full font-medium transition-all duration-150 hover:shadow-sm" style={{ backgroundColor: `${tag.color}18`, color: tag.color }}>
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.id)} className="p-0.5 rounded-full hover:bg-black/10 transition-colors duration-150"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                  {availableTags.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/20 flex items-center justify-center hover:border-primary hover:text-primary transition-all duration-150"><Plus className="w-3 h-3" /></button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1.5" align="start">
                        {availableTags.map((tag) => (
                          <button key={tag.id} onClick={() => handleAddTag(tag.id)} className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm hover:bg-secondary transition-colors duration-150">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3 border-b border-border/30">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Actions</h3>
                <div className="flex flex-col gap-1.5">
                  <Button variant="outline" size="sm" className="justify-start gap-2 rounded-lg border-border/40" onClick={() => downloadDocument(doc.id, doc.name)}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  {optimisticShared ? (
                    <>
                      <Button variant="outline" size="sm" className="justify-start gap-2 rounded-lg border-border/40" onClick={openShareSettings}>
                        <Share2 className="w-3.5 h-3.5" /> Edit Share Settings
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start gap-2 rounded-lg border-border/40" onClick={handleDisableSharing}>
                        <Share2 className="w-3.5 h-3.5" /> Disable Sharing
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="justify-start gap-2 rounded-lg border-border/40" onClick={openShareSettings}>
                      <Share2 className="w-3.5 h-3.5" /> Share Link
                    </Button>
                  )}
                  {hasShareUrl && (
                    <Button variant="ghost" size="sm" className="justify-start gap-2 text-xs text-muted-foreground rounded-lg" onClick={handleCopyLink}>
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2.5">Private Notes</h3>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add private notes about this document..." className="flex-1 min-h-[100px] resize-none text-sm rounded-lg border-border/40 focus:border-primary/30" />
                <Button size="sm" className="mt-2.5 self-end rounded-lg" onClick={handleSaveNote}>Save Note</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{optimisticShared ? 'Edit share settings' : 'Share this document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                A share link is public by default. Add expiration, password, or both for extra control.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border border-border/50 p-3">
                <Label htmlFor="share-expires-at">Auto-disable at</Label>
                <Input id="share-expires-at" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>

              <div className="space-y-2 rounded-lg border border-border/50 p-3">
                <Label htmlFor="share-password">Password protect</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Leave blank for no password"
                  minLength={4}
                />
              </div>
            </div>

            <Button className="w-full h-10" onClick={handleGenerateShareLink}>{optimisticShared ? 'Update share settings' : 'Generate link'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
