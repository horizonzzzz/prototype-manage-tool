'use client';

import { useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getBrowserStorage, readThemePreference, type AppTheme, writeThemePreference } from '@/lib/ui/app-preferences';
import { cn } from '@/lib/utils';

function applyThemeToDocument(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>('light');

  useEffect(() => {
    const storedTheme = readThemePreference(getBrowserStorage());
    setTheme(storedTheme);
    applyThemeToDocument(storedTheme);
  }, []);

  const onThemeSelect = (nextValue: AppTheme) => {
    setTheme(nextValue);
    writeThemePreference(getBrowserStorage(), nextValue);
    applyThemeToDocument(nextValue);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border border-[color:var(--border)] !bg-[color:var(--secondary)] !text-[color:var(--foreground)] hover:!bg-[color:var(--accent)]"
        >
          <Sun className={cn('size-4 transition-transform', theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100')} />
          <Moon
            className={cn('absolute size-4 transition-transform', theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0')}
          />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]">
        <DropdownMenuItem
          className="text-[color:var(--foreground)] focus:bg-[color:var(--accent)] focus:text-[color:var(--foreground)]"
          onSelect={() => onThemeSelect('light')}
        >
          <span className="mr-2 inline-flex w-4">{theme === 'light' ? <Check className="size-4" /> : null}</span>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[color:var(--foreground)] focus:bg-[color:var(--accent)] focus:text-[color:var(--foreground)]"
          onSelect={() => onThemeSelect('dark')}
        >
          <span className="mr-2 inline-flex w-4">{theme === 'dark' ? <Check className="size-4" /> : null}</span>
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
