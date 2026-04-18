import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('DropdownMenuItem', () => {
  it('applies the shared destructive classes when destructive is set', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent forceMount>
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const item = screen.getByText('Delete');
    expect(item.className).toContain('text-destructive');
    expect(item.className).toContain('dark:data-[highlighted]:bg-destructive/20');
  });
});
