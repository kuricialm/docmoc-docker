import { useState } from 'react';
import { useDocuments, useDocumentMutations, Document } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatFileSize, getFileTypeInfo } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';

type Props = { search: string };

export default function TrashPage({ search }: Props) {
  const { data: docs = [] } = useDocuments({ trashed: true });
  const { restoreDocument, permanentDelete } = useDocumentMutations();

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Trash</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Documents are permanently deleted after 30 days</p>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-20">Trash is empty</p>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {filtered.map((doc) => {
            const daysLeft = doc.trashed_at
              ? Math.max(0, 30 - Math.floor((Date.now() - new Date(doc.trashed_at).getTime()) / 86400000))
              : 30;
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                <FileTypeIcon fileType={doc.file_type} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)} -- {daysLeft} days left</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => restoreDocument.mutate(doc.id)} className="gap-1.5 text-xs shrink-0">
                  <RotateCcw className="w-3 h-3" /> Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => permanentDelete.mutate({ id: doc.id, storagePath: doc.storage_path })}
                  className="gap-1.5 text-xs text-destructive shrink-0"
                >
                  <Trash2 className="w-3 h-3" /> Delete Forever
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
