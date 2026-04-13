import { useMemo, useState } from 'react';
import { useDocuments, Document } from '@/hooks/useDocuments';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import { Clock } from 'lucide-react';

type Props = { viewMode: 'grid' | 'list'; search: string };

export default function RecentPage({ viewMode, search }: Props) {
  const { data: docs = [] } = useDocuments({ recent: true });
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const viewDoc = useMemo(() => docs.find((doc) => doc.id === viewDocId) ?? null, [docs, viewDocId]);

  return (
    <div className="space-y-6 animate-page-in">
      <h2 className="text-xl font-semibold tracking-tight">Recent</h2>
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No recent documents</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((doc) => <DocumentCard key={doc.id} document={doc} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />)}
        </div>
      ) : (
        <DocumentListView documents={filtered} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />
      )}
      <DocumentViewer document={viewDoc} open={!!viewDocId} onClose={() => setViewDocId(null)} />
      <RenameDialog document={renameDoc} open={!!renameDoc} onClose={() => setRenameDoc(null)} />
    </div>
  );
}
