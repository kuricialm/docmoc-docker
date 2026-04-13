import { useMemo, useState } from 'react';
import { useDocuments, useDocumentMutations, Document } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Share2, Copy } from 'lucide-react';
import { formatFileSize } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';
import { toast } from 'sonner';
import DocumentViewer from '@/components/DocumentViewer';

type Props = { search: string };

export default function SharedPage({ search }: Props) {
  const { data: docs = [] } = useDocuments({ shared: true });
  const { toggleShare } = useDocumentMutations();
  const [viewDocId, setViewDocId] = useState<string | null>(null);

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const viewDoc = useMemo(() => docs.find((doc) => doc.id === viewDocId) ?? null, [docs, viewDocId]);

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    toast.success('Link copied');
  };

  return (
    <div className="space-y-6 animate-page-in">
      <h2 className="text-xl font-semibold tracking-tight">Shared by Me</h2>
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Share2 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No shared documents</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-card border border-border/50 rounded-xl p-3.5 sm:p-4 hover:border-border/80 transition-colors duration-150">
              <div className="flex items-center gap-3 sm:gap-4">
                <FileTypeIcon fileType={doc.file_type} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors duration-150" onClick={() => setViewDocId(doc.id)}>{doc.name}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{formatFileSize(doc.file_size)}</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {doc.share_token && (
                    <Button variant="ghost" size="sm" onClick={() => copyLink(doc.share_token!)} className="gap-1.5 text-xs rounded-lg h-8 px-2 sm:px-3">
                      <Copy className="w-3 h-3" /> <span className="hidden sm:inline">Copy Link</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleShare.mutate({ id: doc.id, shared: false })}
                    className="gap-1.5 text-xs rounded-lg h-8 px-2 sm:px-3 border-border/40"
                  >
                    <span className="hidden sm:inline">Disable Sharing</span>
                    <span className="sm:hidden">Disable</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <DocumentViewer document={viewDoc} open={!!viewDocId} onClose={() => setViewDocId(null)} />
    </div>
  );
}
