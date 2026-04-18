import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentDragContext } from '@/contexts/DocumentDragContext';
import { useTags } from '@/hooks/useTags';
import {
  FileText, Clock, Star, Share2, Trash2, Settings, Shield, ChevronLeft, Tags,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTagDropTargetId,
  SIDEBAR_STARRED_DROP_TARGET_ID,
  SIDEBAR_TRASH_DROP_TARGET_ID,
} from '@/lib/documentDragDrop';
import TagManager from './TagManager';

const navItems = [
  { label: 'All Documents', icon: FileText, path: '/' },
  { label: 'Recent', icon: Clock, path: '/recent' },
  { label: 'Starred', icon: Star, path: '/starred', dropTargetId: SIDEBAR_STARRED_DROP_TARGET_ID },
  { label: 'Shared by Me', icon: Share2, path: '/shared' },
  { label: 'Trash', icon: Trash2, path: '/trash', dropTargetId: SIDEBAR_TRASH_DROP_TARGET_ID, destructive: true },
];

type SidebarLinkProps = {
  to: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  title?: string;
  icon?: typeof FileText;
  dotColor?: string;
  dropTargetId?: string;
  destructive?: boolean;
};

function SidebarLinkItem({
  to,
  label,
  active,
  collapsed,
  onClick,
  title,
  icon: Icon,
  dotColor,
  dropTargetId,
  destructive = false,
}: SidebarLinkProps) {
  const { enabled, activeDocument, activeTargetId } = useDocumentDragContext();
  const dropReady = Boolean(dropTargetId && enabled && activeDocument);
  const { isOver, setNodeRef } = useDroppable({
    id: dropTargetId || `sidebar:static:${to}`,
    disabled: !dropReady,
  });
  const isDropActive = Boolean(dropTargetId && activeTargetId === dropTargetId && isOver);

  const baseClasses = collapsed
    ? 'justify-center px-0'
    : dotColor
      ? 'gap-2.5 py-1.5 px-2'
      : 'gap-3 px-3 py-2';

  const stateClasses = isDropActive
    ? destructive
      ? 'bg-destructive/12 text-destructive border-destructive/35'
      : 'bg-primary/10 text-foreground border-primary/20'
    : active
      ? 'bg-muted text-foreground font-medium'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted';

  const style = isDropActive && dotColor
    ? {
      backgroundColor: `${dotColor}1a`,
      boxShadow: `inset 0 0 0 1px ${dotColor}55, 0 18px 32px -28px hsl(var(--foreground) / 0.55)`,
      color: 'hsl(var(--foreground))',
    }
    : undefined;

  return (
    <Link
      ref={setNodeRef}
      to={to}
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-lg text-sm border border-transparent transition-all duration-150 sidebar-drop-target',
        baseClasses,
        stateClasses,
        isDropActive && 'sidebar-drop-target-active',
      )}
      style={style}
      title={title}
    >
      {Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      )}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

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
              <SidebarLinkItem
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                active={active}
                collapsed={collapsed}
                onClick={() => isMobile && onMobileClose?.()}
                title={collapsed ? item.label : undefined}
                dropTargetId={item.dropTargetId}
                destructive={item.destructive}
              />
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
                    <SidebarLinkItem
                      key={tag.id}
                      to={`/tag/${tag.id}`}
                      label={tag.name}
                      active={active}
                      collapsed={false}
                      onClick={() => isMobile && onMobileClose?.()}
                      dotColor={tag.color}
                      dropTargetId={getTagDropTargetId(tag.id)}
                    />
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
