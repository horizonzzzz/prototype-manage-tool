'use client';

import { useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getBrowserStorage, readThemePreference, type AppTheme, writeThemePreference } from '@/lib/ui/app-preferences';

function applyThemeToDocument(theme: AppTheme) {
  const resolvedTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>('system');

  useEffect(() => {
    const storedTheme = readThemePreference(getBrowserStorage());
    setTheme(storedTheme);
    applyThemeToDocument(storedTheme);
  }, []);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeToDocument('system');

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [theme]);

  const onThemeSelect = (nextValue: AppTheme) => {
    setTheme(nextValue);
    writeThemePreference(getBrowserStorage(), nextValue);
    applyThemeToDocument(nextValue);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Switch theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onThemeSelect('light')}>
          <span className="mr-2 inline-flex w-4">{theme === 'light' ? <Check className="size-4" /> : null}</span>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onThemeSelect('dark')}>
          <span className="mr-2 inline-flex w-4">{theme === 'dark' ? <Check className="size-4" /> : null}</span>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onThemeSelect('system')}>
          <span className="mr-2 inline-flex w-4">{theme === 'system' ? <Check className="size-4" /> : null}</span>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
