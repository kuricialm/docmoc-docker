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
  const { isAdmin, profile } = useAuth();
  const { data: tags } = useTags();
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  return (
    <>
      {isMobile && mobileOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity" onClick={onMobileClose} />}
      <aside
        aria-hidden={isMobile ? !mobileOpen : undefined}
        className={cn(
          'h-screen flex flex-col border-r transition-all duration-250 ease-out shrink-0',
          isMobile
            ? cn(
              'fixed top-0 left-0 z-40 w-[85vw] max-w-72',
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            )
            : collapsed ? 'w-16' : 'w-60',
        )}
        style={{ backgroundColor: 'hsl(var(--sidebar-bg))', borderColor: 'hsl(var(--sidebar-border))' }}
      >
        <div className="h-14 flex items-center px-4 gap-2.5 shrink-0">
          {!collapsed && (
            <>
              {profile?.workspace_logo_url ? (
                <img src={profile.workspace_logo_url} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="text-sm font-semibold text-white tracking-tight">Docmoc</span>
            </>
          )}
          <button
            onClick={onToggle}
            className={cn('p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-150 ml-auto', collapsed && 'mx-auto')}
          >
            <ChevronLeft className={cn('w-4 h-4 text-white/50 transition-transform duration-200', collapsed && 'rotate-180')} />
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
                    ? 'bg-white/10 text-white font-medium shadow-sm shadow-white/5 border-l-2 border-primary ml-0 pl-[10px]'
                    : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06] border-l-2 border-transparent ml-0 pl-[10px]',
                  collapsed && 'justify-center px-0 border-l-0 pl-0',
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
                <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium">Tags</p>
                <button
                  onClick={() => setTagManagerOpen(true)}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors duration-150"
                  title="Manage Tags"
                >
                  <Tags className="w-3 h-3 text-white/35 hover:text-white/60" />
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
                        active ? 'text-white font-medium bg-white/10' : 'text-white/45 hover:text-white/75 hover:bg-white/[0.06]',
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/10" style={{ backgroundColor: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                    </Link>
                  );
                })}
                {(!tags || tags.length === 0) && (
                  <button
                    onClick={() => setTagManagerOpen(true)}
                    className="text-xs text-white/25 hover:text-white/45 transition-colors duration-150 py-1"
                  >
                    Create your first tag
                  </button>
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="px-2 py-2.5 space-y-0.5 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <Link
            to="/settings"
            onClick={() => isMobile && onMobileClose?.()}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              location.pathname === '/settings'
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]',
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
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]',
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
