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
    <header className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-md flex items-center px-3 sm:px-5 gap-2 sm:gap-3 shrink-0 sticky top-0 z-20">
      {isMobile && (
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onMenuToggle}>
          <Menu className="w-4 h-4" />
        </Button>
      )}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isMobile ? 'Search...' : 'Search documents...'}
          className="pl-9 h-9 bg-secondary/40 border-border/30 focus-visible:ring-1 focus-visible:bg-card transition-all duration-150 rounded-lg"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <div className="hidden sm:flex items-center bg-secondary/40 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md ${viewMode === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md ${viewMode === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
        </Button>

        <Button onClick={onUpload} size="sm" className="h-8 ml-1 sm:ml-2 gap-1.5 text-xs px-2.5 sm:px-3.5 rounded-lg font-medium">
          <Upload className="w-3.5 h-3.5" />
          {!isMobile && 'Upload'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-2 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold text-primary hover:from-primary/30 hover:to-primary/20 transition-all duration-150 ring-2 ring-transparent hover:ring-primary/20">
              {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5">
            <div className="px-3 py-2.5 mb-1">
              <p className="text-sm font-semibold truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{profile?.email}</p>
            </div>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 rounded-lg">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive rounded-lg">
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
