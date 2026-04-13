import { useState, useRef, useEffect, useCallback } from 'react';
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
import { useDocumentMutations } from '@/hooks/useDocuments';
import { useIsMobile } from '@/hooks/use-mobile';
import { ACCEPTED_UPLOAD_ATTR, isAcceptedUploadFile } from '@/lib/fileTypes';
import { Upload, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export default function MainLayout() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [uploadTrigger, setUploadTrigger] = useState(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument } = useDocumentMutations();

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile]);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const accepted = Array.from(files).filter(isAcceptedUploadFile);
    const rejected = files.length - accepted.length;
    accepted.forEach((f) => uploadDocument.mutate(f));
    if (rejected > 0) {
      toast.error(`${rejected} file${rejected > 1 ? 's were' : ' was'} skipped (unsupported format).`);
    }
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
    const accepted = files.filter(isAcceptedUploadFile);
    const rejected = files.length - accepted.length;
    accepted.forEach((f) => uploadDocument.mutate(f));
    if (rejected > 0) {
      toast.error(`${rejected} file${rejected > 1 ? 's were' : ' was'} skipped (unsupported format).`);
    }
  }, [hasFileDrag, resetDragState, uploadDocument]);

  return (
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
            <Route path="/" element={<AllDocuments viewMode={viewMode} onViewModeChange={setViewMode} search={search} uploadTrigger={uploadTrigger} />} />
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
  );
}
