import { useState, useEffect } from 'react';
import { Document } from '@/hooks/useDocuments';
import { useDocumentNote, useNoteMutations } from '@/hooks/useNotes';
import { useTags, useTagMutations } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';
import { getFileTypeInfo, formatFileSize, isPreviewable, isImageType } from '@/lib/fileTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X, Download, Share2, Copy, Star, Plus } from 'lucide-react';
import FileTypeIcon from './FileTypeIcon';
import { useDocumentMutations } from '@/hooks/useDocuments';
import { toast } from 'sonner';

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
  const { data: note } = useDocumentNote(doc?.id);
  const { upsertNote } = useNoteMutations();
  const { downloadDocument, toggleShare, toggleStar } = useDocumentMutations();
  const { data: allTags } = useTags();
  const { addTagToDocument, removeTagFromDocument } = useTagMutations();

  useEffect(() => {
    if (note) setNoteText(note.content);
    else setNoteText('');
  }, [note]);

  useEffect(() => {
    if (!doc || !open) { setPreviewUrl(null); setTextContent(null); return; }

    const loadPreview = async () => {
      if (doc.file_type === 'text/plain') {
        const { data } = await supabase.storage.from('documents').download(doc.storage_path);
        if (data) setTextContent(await data.text());
      } else if (doc.file_type === 'application/pdf' || isImageType(doc.file_type)) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
        if (data) setPreviewUrl(data.signedUrl);
      }
    };
    loadPreview();
  }, [doc, open]);

  useEffect(() => {
    if (!doc) return;
    setOptimisticStarred(doc.starred);
    setOptimisticTags(doc.tags || []);
  }, [doc]);

  if (!doc) return null;
  const typeInfo = getFileTypeInfo(doc.file_type);
  const shareUrl = doc.shared && doc.share_token ? `${window.location.origin}/shared/${doc.share_token}` : null;
  const docTagIds = optimisticTags?.map((t) => t.id) || [];
  const availableTags = allTags?.filter((t) => !docTagIds.includes(t.id)) || [];

  const handleSaveNote = () => {
    upsertNote.mutate({ documentId: doc.id, content: noteText });
    toast.success('Note saved');
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    }
  };

  const handleToggleStar = () => {
    const nextStarred = !optimisticStarred;
    setOptimisticStarred(nextStarred);
    toggleStar.mutate(
      { id: doc.id, starred: nextStarred },
      { onError: () => setOptimisticStarred(!nextStarred) }
    );
  };

  const handleAddTag = (tagId: string) => {
    const tagToAdd = allTags?.find((tag) => tag.id === tagId);
    if (!tagToAdd) return;

    setOptimisticTags((prev) => [...(prev || []), tagToAdd]);
    addTagToDocument.mutate(
      { documentId: doc.id, tagId: tagToAdd.id },
      {
        onError: () => {
          setOptimisticTags((prev) => (prev || []).filter((tag) => tag.id !== tagToAdd.id));
        },
      }
    );
  };

  const handleRemoveTag = (tagId: string) => {
    const removedTag = optimisticTags?.find((tag) => tag.id === tagId);
    if (!removedTag) return;

    setOptimisticTags((prev) => (prev || []).filter((tag) => tag.id !== tagId));
    removeTagFromDocument.mutate(
      { documentId: doc.id, tagId },
      {
        onError: () => {
          setOptimisticTags((prev) => [...(prev || []), removedTag]);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0 rounded-xl">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleStar}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              aria-label={optimisticStarred ? 'Unstar document' : 'Star document'}
            >
              <Star className={`w-4 h-4 ${optimisticStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`} />
            </button>
            <DialogTitle className="text-base font-semibold truncate flex-1">{doc.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-secondary/20 flex items-center justify-center overflow-auto p-4">
            {doc.file_type === 'application/pdf' && previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full rounded-lg border" title="PDF Preview" />
            ) : doc.file_type === 'text/plain' && textContent !== null ? (
              <pre className="w-full h-full overflow-auto p-4 text-sm font-mono bg-card rounded-lg border whitespace-pre-wrap">{textContent}</pre>
            ) : isImageType(doc.file_type) && previewUrl ? (
              <img src={previewUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3">
                <FileTypeIcon fileType={doc.file_type} size="lg" />
                <p className="text-sm text-muted-foreground">Preview not available for this format</p>
                <Button variant="outline" size="sm" onClick={() => downloadDocument(doc.storage_path, doc.name)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download to view
                </Button>
              </div>
            )}
          </div>

          <div className="w-80 border-l flex flex-col overflow-y-auto">
            <div className="p-4 space-y-4 border-b">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium px-1.5 py-0.5 rounded text-xs" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>{typeInfo.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uploaded</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modified</span>
                  <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Inline Tags */}
            <div className="p-4 space-y-2 border-b">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {optimisticTags?.map((tag) => (
                  <span key={tag.id} className="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full font-medium transition-colors" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {availableTags.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1.5" align="start">
                      {availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.id)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3 border-b">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</h3>
              <div className="flex flex-col gap-1.5">
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => downloadDocument(doc.storage_path, doc.name)}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => toggleShare.mutate({ id: doc.id, shared: !doc.shared })}
                >
                  <Share2 className="w-3.5 h-3.5" /> {doc.shared ? 'Disable Sharing' : 'Share Link'}
                </Button>
                {shareUrl && (
                  <Button variant="ghost" size="sm" className="justify-start gap-2 text-xs text-muted-foreground" onClick={handleCopyLink}>
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Private Notes</h3>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add private notes about this document..."
                className="flex-1 min-h-[100px] resize-none text-sm"
              />
              <Button size="sm" className="mt-2 self-end" onClick={handleSaveNote}>
                Save Note
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
