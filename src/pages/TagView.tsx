import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useTags, useTagMutations } from '@/hooks/useTags';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

type Props = { viewMode: 'grid' | 'list'; search: string };

export default function TagView({ viewMode, search }: Props) {
  const { tagId } = useParams<{ tagId: string }>();
  const { data: tags } = useTags();
  const { data: docs = [] } = useDocuments({ tagId });
  const { updateTag, deleteTag } = useTagMutations();
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const tag = tags?.find((t) => t.id === tagId);
  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const viewDoc = useMemo(() => docs.find((doc) => doc.id === viewDocId) ?? null, [docs, viewDocId]);

  if (!tag) return <p className="text-muted-foreground text-center py-20">Tag not found</p>;

  const handleSave = () => {
    if (editName.trim()) {
      updateTag.mutate({ id: tag.id, name: editName.trim(), color: tag.color });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    deleteTag.mutate(tag.id);
    toast.success('Tag deleted');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
        {editing ? (
          <div className="flex items-center gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-48" autoFocus />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold">{tag.name}</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(true); setEditName(tag.name); }}><Edit2 className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-20">No documents with this tag</p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
