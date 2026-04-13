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
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/20">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Size</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Modified</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Tags</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const typeInfo = getFileTypeInfo(doc.file_type);
              return (
                <tr
                  key={doc.id}
                  className="border-b border-border/30 last:border-b-0 cursor-pointer group hover:bg-secondary/30 transition-colors duration-150"
                  onClick={() => onView(doc)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <FileTypeIcon fileType={doc.file_type} size="sm" />
                      <span className="font-medium truncate max-w-[200px]">{doc.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: doc.id, starred: !doc.starred }); }}
                        className={cn('shrink-0 transition-all duration-150', doc.starred ? 'text-amber-400' : 'text-muted-foreground/20 opacity-0 group-hover:opacity-100')}
                      >
                        <Star className="w-3.5 h-3.5" fill={doc.starred ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                    {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="flex gap-1">
                      {doc.tags?.slice(0, 3).map((tag) => (
                        <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-lg hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all duration-150">
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

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-2">
        {documents.map((doc) => {
          const typeInfo = getFileTypeInfo(doc.file_type);
          return (
            <div
              key={doc.id}
              className="bg-card border border-border/50 rounded-xl p-3.5 flex items-center gap-3 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              onClick={() => onView(doc)}
            >
              <FileTypeIcon fileType={doc.file_type} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}>
                    {typeInfo.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: doc.id, starred: !doc.starred }); }}
                className={cn('shrink-0 p-1', doc.starred ? 'text-amber-400' : 'text-muted-foreground/30')}
              >
                <Star className="w-4 h-4" fill={doc.starred ? 'currentColor' : 'none'} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-1 shrink-0">
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
            </div>
          );
        })}
      </div>
    </>
  );
}
