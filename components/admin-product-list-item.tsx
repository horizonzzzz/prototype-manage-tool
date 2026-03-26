'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ProductListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type AdminProductListItemProps = {
  item: ProductListItem;
  selected: boolean;
  onSelect: (productKey: string) => void;
  onDelete: (item: ProductListItem) => void;
};

export function AdminProductListItem({ item, selected, onSelect, onDelete }: AdminProductListItemProps) {
  return (
    <li className="list-none">
      <div className="flex items-start gap-2">
        <button
          type="button"
          data-sidebar-item="true"
          aria-pressed={selected}
          className={cn(
            'w-full min-w-0 rounded-[14px] border px-4 py-3 text-left transition-all',
            selected
              ? 'border-sky-200 bg-sky-50/90 shadow-[var(--shadow-soft)]'
              : 'border-transparent bg-transparent hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white/80',
          )}
          onClick={() => onSelect(item.key)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold leading-6 text-slate-800" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 rounded-full border border-[color:var(--border)] bg-slate-50/90 px-2.5 py-1 font-mono text-[12px] text-slate-500">
                  {item.key}
                </span>
              </div>
              <span className="mt-1 inline-block text-xs text-slate-500">{item.publishedCount} 个已发布版本</span>
            </div>
          </div>
        </button>

        <Button
          type="button"
          variant="ghost"
          className="mt-1 h-auto rounded-xl px-2 py-2 text-slate-400 hover:bg-transparent hover:text-rose-600"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
        >
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>
    </li>
  );
}
