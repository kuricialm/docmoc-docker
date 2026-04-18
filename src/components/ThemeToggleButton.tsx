import type { ComponentProps } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

type ThemeToggleButtonProps = Omit<ComponentProps<typeof Button>, 'aria-label' | 'onClick' | 'children'>;

export default function ThemeToggleButton({ className, ...props }: ThemeToggleButtonProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle theme"
      className={className}
      onClick={toggleTheme}
      {...props}
    >
      {isDark ? (
        <Sun className={cn('w-4 h-4 text-amber-400')} />
      ) : (
        <Moon className={cn('w-4 h-4 text-muted-foreground')} />
      )}
    </Button>
  );
}
