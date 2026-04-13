import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import {
  FileText, Clock, Star, Share2, Trash2, Settings, Shield, ChevronLeft, Tags,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TagManager from './TagManager';

const navItems = [
  { label: 'All Documents', icon: FileText, path: '/' },
  { label: 'Recent', icon: Clock, path: '/recent' },
  { label: 'Starred', icon: Star, path: '/starred' },
  { label: 'Shared by Me', icon: Share2, path: '/shared' },
  { label: 'Trash', icon: Trash2, path: '/trash' },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function AppSidebar({
  collapsed,
  onToggle,
  isMobile = false,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const location = useLocation();
  const { isAdmin, appSettings } = useAuth();
  const { data: tags } = useTags();
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  return (
    <>
      {isMobile && mobileOpen && <div className="fixed inset-0 bg-black/20 z-30 transition-opacity" onClick={onMobileClose} />}
      <aside
        aria-hidden={isMobile ? !mobileOpen : undefined}
        className={cn(
          'h-screen flex flex-col border-r border-border bg-background transition-all duration-200 ease-out shrink-0',
          isMobile
            ? cn(
              'fixed top-0 left-0 z-40 w-[85vw] max-w-64',
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            )
            : collapsed ? 'w-16' : 'w-56',
        )}
      >
        <div className="h-14 flex items-center px-4 gap-2.5 shrink-0 border-b border-border">
          {!collapsed && (
            <>
              {appSettings.workspace_logo_url ? (
                <img src={appSettings.workspace_logo_url} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
                  <FileText className="w-4 h-4 text-background" />
                </div>
              )}
              <span className="text-sm font-semibold text-foreground tracking-tight">Docmoc</span>
            </>
          )}
          <button
            onClick={onToggle}
            className={cn('p-1.5 rounded-lg hover:bg-muted transition-colors duration-150 ml-auto', collapsed && 'mx-auto')}
          >
            <ChevronLeft className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && onMobileClose?.()}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  active
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  collapsed && 'justify-center px-0',
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {!collapsed && (
            <div className="mt-7 px-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Tags</p>
                <button
                  onClick={() => setTagManagerOpen(true)}
                  className="p-1 rounded-md hover:bg-muted transition-colors duration-150"
                  title="Manage Tags"
                >
                  <Tags className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-0.5">
                {tags?.map((tag) => {
                  const active = location.pathname === `/tag/${tag.id}`;
                  return (
                    <Link
                      key={tag.id}
                      to={`/tag/${tag.id}`}
                      onClick={() => isMobile && onMobileClose?.()}
                      className={cn(
                        'flex items-center gap-2.5 py-1.5 px-2 text-sm transition-all duration-150 rounded-lg',
                        active ? 'text-foreground font-medium bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                    </Link>
                  );
                })}
                {(!tags || tags.length === 0) && (
                  <button
                    onClick={() => setTagManagerOpen(true)}
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-150 py-1"
                  >
                    Create your first tag
                  </button>
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="px-2 py-2.5 space-y-0.5 border-t border-border">
          <Link
            to="/settings"
            onClick={() => isMobile && onMobileClose?.()}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              location.pathname === '/settings'
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              collapsed && 'justify-center px-0',
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => isMobile && onMobileClose?.()}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                location.pathname === '/admin'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                collapsed && 'justify-center px-0',
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
        </div>
      </aside>

      <TagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
    </>
  );
}
