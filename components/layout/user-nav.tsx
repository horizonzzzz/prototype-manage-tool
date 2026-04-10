'use client';

import { LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function UserNav() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full border border-[color:var(--border)] !bg-[color:var(--secondary)] !text-[color:var(--foreground)] hover:!bg-[color:var(--accent)]"
        >
          <Avatar className="size-8">
            <AvatarFallback>AU</AvatarFallback>
          </Avatar>
          <span className="sr-only">Open user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Admin User</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">admin@example.com</p>
        </div>
        <DropdownMenuItem
          className="text-[color:var(--foreground)] focus:bg-[color:var(--accent)] focus:text-[color:var(--foreground)]"
          onSelect={() => router.push('/settings')}
        >
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[color:var(--foreground)] focus:bg-[color:var(--accent)] focus:text-[color:var(--foreground)]"
          onSelect={() => router.push('/login')}
        >
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
