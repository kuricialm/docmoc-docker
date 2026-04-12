import { useState } from 'react';
import { useDocuments, useDocumentMutations, Document } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { Share2, Copy, ExternalLink } from 'lucide-react';
import { formatFileSize, getFileTypeInfo } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';
import { toast } from 'sonner';
import DocumentViewer from '@/components/DocumentViewer';

type Props = { search: string };

export default function SharedPage({ search }: Props) {
  const { data: docs = [] } = useDocuments({ shared: true });
  const { toggleShare } = useDocumentMutations();
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    toast.success('Link copied');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Shared by Me</h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-20">No shared documents</p>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {filtered.map((doc) => {
            const typeInfo = getFileTypeInfo(doc.file_type);
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                <FileTypeIcon fileType={doc.file_type} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate cursor-pointer hover:text-primary" onClick={() => setViewDoc(doc)}>{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                </div>
                {doc.share_token && (
                  <Button variant="ghost" size="sm" onClick={() => copyLink(doc.share_token!)} className="gap-1.5 text-xs shrink-0">
                    <Copy className="w-3 h-3" /> Copy Link
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleShare.mutate({ id: doc.id, shared: false })}
                  className="gap-1.5 text-xs shrink-0"
                >
                  Disable Sharing
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <DocumentViewer document={viewDoc} open={!!viewDoc} onClose={() => setViewDoc(null)} />
    </div>
  );
}
