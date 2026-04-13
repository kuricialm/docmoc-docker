import { useEffect, useState } from 'react';
import { Document } from '@/hooks/useDocuments';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDocumentMutations } from '@/hooks/useDocuments';

type Props = {
  document: Document | null;
  open: boolean;
  onClose: () => void;
};

export default function RenameDialog({ document: doc, open, onClose }: Props) {
  const [name, setName] = useState('');
  const { renameDocument } = useDocumentMutations();

  useEffect(() => {
    if (open) {
      setName('');
    }
  }, [open, doc?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || !name.trim()) return;
    renameDocument.mutate({ id: doc.id, name: name.trim() });
    onClose();
  };

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Rename Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={doc.name}
            autoFocus
            className="h-9"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm">Rename</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
