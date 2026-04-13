import { Document, useDocumentMutations } from '@/hooks/useDocuments';
import { getFileTypeInfo, formatFileSize } from '@/lib/fileTypes';
import { Star, Download, Share2, Trash2, MoreVertical, Eye, Edit2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FileTypeIcon from './FileTypeIcon';
import { cn } from '@/lib/utils';

type Props = {
  documents: Document[];
  onView: (doc: Document) => void;
  onRename: (doc: Document) => void;
};

export default function DocumentListView({ documents, onView, onRename }: Props) {
  const { toggleStar, trashDocument, toggleShare, downloadDocument } = useDocumentMutations();

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-secondary/30">
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Name</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden md:table-cell">Type</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden md:table-cell">Size</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Modified</th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Tags</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const typeInfo = getFileTypeInfo(doc.file_type);
            return (
              <tr
                key={doc.id}
                className="border-b last:border-b-0 cursor-pointer transition-colors group touch-manipulation md:hover:bg-secondary/20"
                onClick={() => onView(doc)}
              >
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-3">
                    <FileTypeIcon fileType={doc.file_type} size="sm" />
                    <span className="font-medium truncate max-w-[200px]">{doc.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: doc.id, starred: !doc.starred }); }}
                      className={cn('shrink-0', doc.starred ? 'text-amber-400' : 'text-muted-foreground/30 md:opacity-0 md:group-hover:opacity-100')}
                    >
                      <Star className="w-3.5 h-3.5" fill={doc.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </td>
                <td className="py-2.5 px-4 hidden md:table-cell">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>
                    {typeInfo.label}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-muted-foreground hidden md:table-cell">{formatFileSize(doc.file_size)}</td>
                <td className="py-2.5 px-4 text-muted-foreground hidden lg:table-cell">
                  {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="py-2.5 px-4 hidden lg:table-cell">
                  <div className="flex gap-1">
                    {doc.tags?.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded-lg hover:bg-secondary md:opacity-0 md:group-hover:opacity-100">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(doc); }} className="gap-2"><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(doc); }} className="gap-2"><Edit2 className="w-3.5 h-3.5" /> Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadDocument(doc.id, doc.name); }} className="gap-2"><Download className="w-3.5 h-3.5" /> Download</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleShare.mutate({ id: doc.id, shared: !doc.shared }); }} className="gap-2"><Share2 className="w-3.5 h-3.5" /> {doc.shared ? 'Unshare' : 'Share'}</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); trashDocument.mutate(doc.id); }} className="gap-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /> Move to Trash</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
