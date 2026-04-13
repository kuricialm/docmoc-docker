import { useDocuments, useDocumentMutations } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatFileSize } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';

type Props = { search: string };

export default function TrashPage({ search }: Props) {
  const { data: docs = [] } = useDocuments({ trashed: true });
  const { restoreDocument, permanentDelete } = useDocumentMutations();

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-page-in">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Trash</h2>
        <p className="text-xs text-muted-foreground/70 mt-1">Documents are permanently deleted after 30 days</p>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Trash2 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Trash is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const daysLeft = doc.trashed_at
              ? Math.max(0, 30 - Math.floor((Date.now() - new Date(doc.trashed_at).getTime()) / 86400000))
              : 30;
            return (
              <div key={doc.id} className="bg-card border border-border/50 rounded-xl flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 hover:border-border/80 transition-colors duration-150">
                <FileTypeIcon fileType={doc.file_type} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{formatFileSize(doc.file_size)} — {daysLeft} days left</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => restoreDocument.mutate(doc.id)} className="gap-1.5 text-xs rounded-lg h-8 px-2 sm:px-3">
                    <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">Restore</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => permanentDelete.mutate({ id: doc.id, storagePath: doc.storage_path })}
                    className="gap-1.5 text-xs text-destructive rounded-lg h-8 px-2 sm:px-3"
                  >
                    <Trash2 className="w-3 h-3" /> <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
