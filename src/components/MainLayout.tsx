import { useState, useRef, useEffect, useCallback } from 'react';
import {
  rectIntersection,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Routes, Route } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import TopBar from '@/components/TopBar';
import AllDocuments from '@/pages/AllDocuments';
import RecentPage from '@/pages/Recent';
import StarredPage from '@/pages/Starred';
import SharedPage from '@/pages/Shared';
import TrashPage from '@/pages/Trash';
import TagView from '@/pages/TagView';
import SettingsPage from '@/pages/Settings';
import AdminPage from '@/pages/Admin';
import { DocumentDragProvider } from '@/contexts/DocumentDragContext';
import { useDocumentMutations } from '@/hooks/useDocuments';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTagMutations } from '@/hooks/useTags';
import {
  getDocumentDragGrabOffset,
  DragDocument,
  getDraggedDocument,
  preserveDocumentDragGrabPoint,
  resolveSidebarDocumentDropCollisions,
  resolveDocumentDropAction,
} from '@/lib/documentDragDrop';
import { ACCEPTED_UPLOAD_ATTR, formatFileSize, getFileTypeInfo } from '@/lib/fileTypes';
import { formatUnsupportedUploadMessage, partitionAcceptedUploadFiles } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import { hasArabicCharacters } from '@/lib/text';
import { Badge } from '@/components/ui/badge';
import FileTypeIcon from '@/components/FileTypeIcon';
import { Star, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

function DocumentDragPreview({ document }: { document: DragDocument }) {
  const typeInfo = getFileTypeInfo(document.file_type);

  return (
    <div className="document-drag-overlay relative flex h-[120px] w-[220px] items-center gap-3 overflow-hidden rounded-2xl border border-border/60 px-4 py-3">
      {document.starred && (
        <Star className="absolute right-3 top-3 h-3.5 w-3.5 text-amber-400" fill="currentColor" />
      )}
      <div className="shrink-0 rounded-xl border border-border/50 bg-background/45 p-2.5">
        <FileTypeIcon fileType={document.file_type} size="sm" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('line-clamp-2 min-w-0 pr-5 text-sm font-semibold leading-snug text-foreground/95', hasArabicCharacters(document.name) && 'font-arabic-text')}>
          {document.name}
        </p>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge
            variant="secondary"
            className="h-5 rounded-md border-0 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor }}
          >
            {typeInfo.label}
          </Badge>
          <span>{formatFileSize(document.file_size)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MainLayout() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [activeDocument, setActiveDocument] = useState<DragDocument | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const dragExpandedSidebarRef = useRef(false);
  const activeGrabOffsetRef = useRef<ReturnType<typeof getDocumentDragGrabOffset>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, toggleStar, trashDocument } = useDocumentMutations();
  const { addTagToDocument } = useTagMutations();
  const dragEnabled = !isMobile;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile]);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const queueUploads = useCallback((files: File[]) => {
    const { accepted, rejectedCount } = partitionAcceptedUploadFiles(files);
    accepted.forEach((file) => uploadDocument.mutate(file));
    if (rejectedCount > 0) {
      toast.error(formatUnsupportedUploadMessage(rejectedCount));
    }
  }, [uploadDocument]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    queueUploads(Array.from(files));
    e.target.value = '';
  };

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
  }, []);

  const hasFileDrag = useCallback((e: React.DragEvent) => {
    return Array.from(e.dataTransfer.types).includes('Files');
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }, [hasFileDrag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [hasFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) resetDragState();
  }, [hasFileDrag, resetDragState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    resetDragState();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    queueUploads(files);
  }, [hasFileDrag, queueUploads, resetDragState]);

  const finishDocumentDrag = useCallback(() => {
    setActiveDocument(null);
    setActiveTargetId(null);
    activeGrabOffsetRef.current = null;
    if (dragExpandedSidebarRef.current) {
      dragExpandedSidebarRef.current = false;
      setSidebarCollapsed(true);
    }
  }, []);

  const handleDocumentDragStart = useCallback((event: DragStartEvent) => {
    const document = getDraggedDocument(event.active.data.current);
    if (!document) return;

    activeGrabOffsetRef.current = getDocumentDragGrabOffset(
      event.activatorEvent,
      event.active.rect.current.initial,
    );
    setActiveDocument(document);
    setActiveTargetId(null);

    if (dragEnabled && sidebarCollapsed) {
      dragExpandedSidebarRef.current = true;
      setSidebarCollapsed(false);
    }
  }, [dragEnabled, sidebarCollapsed]);

  const handleDocumentDragOver = useCallback((event: DragOverEvent) => {
    setActiveTargetId(event.over?.id ? String(event.over.id) : null);
  }, []);

  const handleDocumentDragEnd = useCallback((event: DragEndEvent) => {
    const document = activeDocument || getDraggedDocument(event.active.data.current);
    const action = document ? resolveDocumentDropAction(document, event.over?.id) : null;

    if (document && action && action.kind !== 'noop') {
      if (action.kind === 'starred') {
        toggleStar.mutate({ id: document.id, starred: true });
      }
      if (action.kind === 'trash') {
        trashDocument.mutate(document.id);
      }
      if (action.kind === 'tag') {
        addTagToDocument.mutate({ documentId: document.id, tagId: action.tagId });
      }
    }

    finishDocumentDrag();
  }, [activeDocument, addTagToDocument, finishDocumentDrag, toggleStar, trashDocument]);

  return (
    <DocumentDragProvider value={{ enabled: dragEnabled, activeDocument, activeTargetId }}>
      <DndContext
        modifiers={[preserveDocumentDragGrabPoint]}
        collisionDetection={(args) => {
          const collisions = resolveSidebarDocumentDropCollisions(args, activeGrabOffsetRef.current);
          return collisions.length > 0 ? collisions : rectIntersection(args);
        }}
        sensors={sensors}
        onDragStart={handleDocumentDragStart}
        onDragOver={handleDocumentDragOver}
        onDragEnd={handleDocumentDragEnd}
        onDragCancel={finishDocumentDrag}
      >
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <input ref={fileInputRef} type="file" accept={ACCEPTED_UPLOAD_ATTR} multiple className="hidden" onChange={handleFileChange} />
          <AppSidebar
            collapsed={isMobile ? false : sidebarCollapsed}
            onToggle={() => (isMobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(!sidebarCollapsed))}
            isMobile={isMobile}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
          <div
            className="flex-1 flex flex-col min-w-0 relative"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <TopBar
              search={search}
              onSearchChange={setSearch}
              onUpload={handleUpload}
              onMenuToggle={() => setMobileSidebarOpen((s) => !s)}
              isMobile={isMobile}
            />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <Routes>
                <Route path="/" element={<AllDocuments viewMode={viewMode} onViewModeChange={setViewMode} search={search} />} />
                <Route path="/recent" element={<RecentPage viewMode={viewMode} onViewModeChange={setViewMode} search={search} />} />
                <Route path="/starred" element={<StarredPage viewMode={viewMode} onViewModeChange={setViewMode} search={search} />} />
                <Route path="/shared" element={<SharedPage search={search} />} />
                <Route path="/trash" element={<TrashPage search={search} />} />
                <Route path="/tag/:tagId" element={<TagView viewMode={viewMode} onViewModeChange={setViewMode} search={search} />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </main>

            {isDraggingFiles && (
              <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card/90 px-10 py-10 text-center shadow-2xl backdrop-blur-md">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <UploadCloud className="h-8 w-8 text-foreground/80" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">Upload files</h3>
                  <p className="text-sm text-muted-foreground">Drop files anywhere to add them instantly.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDocument ? <DocumentDragPreview document={activeDocument} /> : null}
        </DragOverlay>
      </DndContext>
    </DocumentDragProvider>
  );
}
