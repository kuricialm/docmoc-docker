import { Button } from '@/components/ui/button';
import { Tag, Trash2 } from 'lucide-react';
import type { Tag as DocTag } from '@/hooks/useTags';

type Props = {
  selectedCount: number;
  tags: DocTag[];
  bulkTagId: string;
  onBulkTagIdChange: (tagId: string) => void;
  onDelete: () => void;
  onApplyTag: () => void;
  onClear: () => void;
};

export default function BulkDocumentToolbar({
  selectedCount,
  tags,
  bulkTagId,
  onBulkTagIdChange,
  onDelete,
  onApplyTag,
  onClear,
}: Props) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <Button variant="destructive" size="sm" className="gap-1.5" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </Button>
      <div className="flex items-center gap-2">
        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={bulkTagId}
          onChange={(e) => onBulkTagIdChange(e.target.value)}
        >
          <option value="">Choose tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={onApplyTag} disabled={!bulkTagId}>
          Apply tag
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
    </div>
  );
}
