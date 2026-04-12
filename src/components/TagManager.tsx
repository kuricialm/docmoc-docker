import { useState } from 'react';
import { useTags, useTagMutations } from '@/hooks/useTags';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const TAG_COLORS = [
  '#3B82F6', '#2563EB', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#64748B', '#6B7280',
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function TagManager({ open, onClose }: Props) {
  const { data: tags } = useTags();
  const { createTag, updateTag, deleteTag } = useTagMutations();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = () => {
    if (!newTagName.trim()) return;
    createTag.mutate({ name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
  };

  const startEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateTag.mutate({ id: editingId, name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {tags?.map((tag) =>
            editingId === tag.id ? (
              <div key={tag.id} className="space-y-2 p-2 rounded-lg bg-secondary/50">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map((c) => (
                    <button key={c} onClick={() => setEditColor(c)} className="w-5 h-5 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: c === editColor ? 'hsl(var(--foreground))' : 'transparent' }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} className="h-7 text-xs"><Check className="w-3 h-3 mr-1" />Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <div key={tag.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-sm flex-1">{tag.name}</span>
                <button onClick={() => startEdit(tag)} className="p-1 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button onClick={() => deleteTag.mutate(tag.id)} className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            )
          )}

          <div className="flex gap-2 pt-2 border-t">
            <div className="flex flex-wrap gap-1 items-center max-w-[140px]">
              {TAG_COLORS.map((c) => (
                <button key={c} onClick={() => setNewTagColor(c)} className="w-4 h-4 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: c === newTagColor ? 'hsl(var(--foreground))' : 'transparent' }} />
              ))}
            </div>
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} className="h-8 shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
