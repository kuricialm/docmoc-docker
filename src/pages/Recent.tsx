import { useState } from 'react';
import { useDocuments, Document } from '@/hooks/useDocuments';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import TagManager from '@/components/TagManager';

type Props = { viewMode: 'grid' | 'list'; search: string };

export default function RecentPage({ viewMode, search }: Props) {
  const { data: docs = [] } = useDocuments({ recent: true });
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [tagDoc, setTagDoc] = useState<Document | null>(null);

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Recent</h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-20">No recent documents</p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => <DocumentCard key={doc.id} document={doc} onView={setViewDoc} onRename={setRenameDoc} onTagManage={setTagDoc} />)}
        </div>
      ) : (
        <DocumentListView documents={filtered} onView={setViewDoc} onRename={setRenameDoc} onTagManage={setTagDoc} />
      )}
      <DocumentViewer document={viewDoc} open={!!viewDoc} onClose={() => setViewDoc(null)} />
      <RenameDialog document={renameDoc} open={!!renameDoc} onClose={() => setRenameDoc(null)} />
      <TagManager document={tagDoc} open={!!tagDoc} onClose={() => setTagDoc(null)} />
    </div>
  );
}
