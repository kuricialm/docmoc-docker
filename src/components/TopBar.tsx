import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutGrid, List, Upload, LogOut, Settings, Menu, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  search: string;
  onSearchChange: (val: string) => void;
  onUpload: () => void;
  onMenuToggle?: () => void;
  isMobile?: boolean;
};

export default function TopBar({ viewMode, onViewModeChange, search, onSearchChange, onUpload, onMenuToggle, isMobile }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <header className="h-14 border-b bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-3 shrink-0">
      {isMobile && (
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onMenuToggle}>
          <Menu className="w-4 h-4" />
        </Button>
      )}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isMobile ? 'Search...' : 'Search documents...'}
          className="pl-9 h-9 bg-secondary/50 border-0 focus-visible:ring-1"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewModeChange('grid')}>
          <LayoutGrid className={`w-4 h-4 ${viewMode === 'grid' ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewModeChange('list')}>
          <List className={`w-4 h-4 ${viewMode === 'list' ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
        </Button>

        <Button onClick={onUpload} size="sm" className="h-8 ml-1 sm:ml-2 gap-1.5 text-xs px-2 sm:px-3">
          <Upload className="w-3.5 h-3.5" />
          {!isMobile && 'Upload'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-2 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
              {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2 border-b">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
