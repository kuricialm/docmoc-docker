import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Upload, LogOut, Settings, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  search: string;
  onSearchChange: (val: string) => void;
  onUpload: () => void;
  onMenuToggle?: () => void;
  isMobile?: boolean;
};

export default function TopBar({ search, onSearchChange, onUpload, onMenuToggle, isMobile }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-3 sm:px-5 gap-2 sm:gap-3 shrink-0 sticky top-0 z-20">
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
          className="pl-9 h-9 bg-muted border-transparent focus-visible:border-border focus-visible:ring-0 rounded-lg"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggleButton variant="ghost" size="icon" className="h-8 w-8 ml-1" />

        <Button onClick={onUpload} size="sm" className="h-8 ml-1 sm:ml-2 gap-1.5 text-xs px-2.5 sm:px-3.5 rounded-lg font-medium">
          <Upload className="w-3.5 h-3.5" />
          {!isMobile && 'Upload'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-2 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground hover:bg-muted/80 transition-all duration-150">
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
            <DropdownMenuItem onClick={signOut} className="gap-2 rounded-lg" destructive>
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
