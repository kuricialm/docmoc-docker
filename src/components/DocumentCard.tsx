import { Document, useDocumentMutations } from '@/hooks/useDocuments';
import { getFileTypeInfo, formatFileSize } from '@/lib/fileTypes';
import { Star, MoreVertical, Download, Edit2, Share2, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import FileTypeIcon from './FileTypeIcon';
import DocumentThumbnail from './DocumentThumbnail';
import { useLocalSettings } from '@/hooks/useLocalSettings';

type Props = {
  document: Document;
  onView: (doc: Document) => void;
  onRename: (doc: Document) => void;
};

export default function DocumentCard({ document: doc, onView, onRename }: Props) {
  const { toggleStar, trashDocument, toggleShare, downloadDocument } = useDocumentMutations();
  const typeInfo = getFileTypeInfo(doc.file_type);
  const { settings } = useLocalSettings();

  return (
    <div
      className="group bg-muted/40 rounded-xl overflow-hidden cursor-pointer touch-manipulation active:scale-[0.98] md:hover:bg-muted transition-all duration-150"
      onClick={() => onView(doc)}
    >
      <div className="h-36 sm:h-40 bg-muted/60 flex items-center justify-center relative">
        <DocumentThumbnail docId={doc.id} fileType={doc.file_type} enabled={settings.thumbnailPreviews} />
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: doc.id, starred: !doc.starred }); }}
          className={cn(
            'absolute top-2.5 right-2.5 p-1.5 rounded-lg transition-all duration-150',
            doc.starred ? 'text-amber-500' : 'text-muted-foreground/30 md:opacity-0 md:group-hover:opacity-100 hover:text-muted-foreground',
          )}
        >
          <Star className="w-4 h-4" fill={doc.starred ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-snug">{doc.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {typeInfo.label}
              </span>
              <span className="text-[11px] text-muted-foreground/70">{formatFileSize(doc.file_size)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1.5 rounded-lg hover:bg-muted md:opacity-0 md:group-hover:opacity-100 transition-all duration-150">
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
              <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/60">
          {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
