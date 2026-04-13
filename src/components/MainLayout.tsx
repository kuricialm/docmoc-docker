import { useState, useRef, useEffect } from 'react';
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

export default function MainLayout() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [uploadTrigger, setUploadTrigger] = useState(0);
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
    Array.from(files).forEach((f) => uploadDocument.mutate(f));
    e.target.value = '';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      <AppSidebar
        collapsed={isMobile ? false : sidebarCollapsed}
        onToggle={() => (isMobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(!sidebarCollapsed))}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          search={search}
          onSearchChange={setSearch}
          onUpload={handleUpload}
          onMenuToggle={() => setMobileSidebarOpen((s) => !s)}
          isMobile={isMobile}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<AllDocuments viewMode={viewMode} search={search} uploadTrigger={uploadTrigger} />} />
            <Route path="/recent" element={<RecentPage viewMode={viewMode} search={search} />} />
            <Route path="/starred" element={<StarredPage viewMode={viewMode} search={search} />} />
            <Route path="/shared" element={<SharedPage search={search} />} />
            <Route path="/trash" element={<TrashPage search={search} />} />
            <Route path="/tag/:tagId" element={<TagView viewMode={viewMode} search={search} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
