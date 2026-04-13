import { Document, useDocumentMutations } from '@/hooks/useDocuments';
import { getFileTypeInfo, formatFileSize } from '@/lib/fileTypes';
import { Star, MoreVertical, Download, Edit2, Share2, Trash2, Eye, Tag } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import FileTypeIcon from './FileTypeIcon';

type Props = {
  document: Document;
  onView: (doc: Document) => void;
  onRename: (doc: Document) => void;
};

export default function DocumentCard({ document: doc, onView, onRename }: Props) {
  const { toggleStar, trashDocument, toggleShare, downloadDocument } = useDocumentMutations();
  const typeInfo = getFileTypeInfo(doc.file_type);

  return (
    <div
      className="group bg-card border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer touch-manipulation active:scale-[0.995] md:hover:shadow-lg md:hover:border-primary/20"
      onClick={() => onView(doc)}
    >
      <div className="h-36 bg-secondary/30 flex items-center justify-center relative">
        <FileTypeIcon fileType={doc.file_type} size="lg" />
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: doc.id, starred: !doc.starred }); }}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-lg transition-all',
            doc.starred ? 'text-amber-400' : 'text-muted-foreground/40 md:opacity-0 md:group-hover:opacity-100',
            'hover:bg-black/5'
          )}
        >
          <Star className="w-4 h-4" fill={doc.starred ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{doc.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}
              >
                {typeInfo.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1 rounded-lg hover:bg-secondary md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(doc); }} className="gap-2">
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(doc); }} className="gap-2">
                <Edit2 className="w-3.5 h-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadDocument(doc.id, doc.name); }} className="gap-2">
                <Download className="w-3.5 h-3.5" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleShare.mutate({ id: doc.id, shared: !doc.shared }); }} className="gap-2">
                <Share2 className="w-3.5 h-3.5" /> {doc.shared ? 'Unshare' : 'Share'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); trashDocument.mutate(doc.id); }} className="gap-2 text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {doc.tags && doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.tags.map((tag) => (
              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
