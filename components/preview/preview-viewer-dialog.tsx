'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Monitor, Smartphone, Tablet, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ProductVersionManifest } from '@/lib/types';
import { cn } from '@/lib/utils';

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

type PreviewViewerDialogProps = {
  open: boolean;
  productName?: string;
  version?: ProductVersionManifest;
  targetUrl?: string;
  onOpenChange: (open: boolean) => void;
  onOpenInNewWindow: () => void;
};

const deviceShellClasses: Record<PreviewDevice, string> = {
  desktop: 'h-full w-full rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.14)]',
  tablet:
    'aspect-[3/4] h-[min(78vh,960px)] rounded-[32px] border-[10px] border-slate-900 bg-white shadow-[0_36px_90px_rgba(15,23,42,0.26)]',
  mobile:
    'aspect-[390/844] h-[min(78vh,820px)] rounded-[40px] border-[12px] border-slate-900 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.3)]',
};

export function PreviewViewerDialog({
  open,
  productName,
  version,
  targetUrl,
  onOpenChange,
  onOpenInNewWindow,
}: PreviewViewerDialogProps) {
  const [device, setDevice] = useState<PreviewDevice>('desktop');

  const title = useMemo(() => {
    if (!productName) {
      return '原型预览';
    }

    return productName;
  }, [productName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-h-none max-w-none gap-0 overflow-hidden rounded-[28px] p-0"
      >
        <div className="flex min-h-0 h-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#e2e8f0_100%)]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/88 px-4 py-3 backdrop-blur md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X />
                <span className="sr-only">关闭预览</span>
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                <div className="truncate text-xs text-slate-500">
                  {version ? `版本 ${version.version}` : '无可用版本'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/90 p-1 md:flex">
                <Button
                  type="button"
                  variant={device === 'desktop' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor />
                  <span className="sr-only">桌面端视图</span>
                </Button>
                <Button
                  type="button"
                  variant={device === 'tablet' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setDevice('tablet')}
                >
                  <Tablet />
                  <span className="sr-only">平板端视图</span>
                </Button>
                <Button
                  type="button"
                  variant={device === 'mobile' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setDevice('mobile')}
                >
                  <Smartphone />
                  <span className="sr-only">移动端视图</span>
                </Button>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={onOpenInNewWindow} disabled={!targetUrl}>
                <ExternalLink />
                新窗口打开
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0,rgba(255,255,255,0.55)_32%,transparent_72%),radial-gradient(#cbd5e1_0.8px,transparent_0.8px)] [background-size:100%_100%,18px_18px] p-3 md:p-6">
            <div className={cn('relative shrink-0 overflow-hidden', deviceShellClasses[device])}>
              {targetUrl ? (
                <iframe
                  key={`${targetUrl}-${device}`}
                  src={targetUrl}
                  title={version ? `${title} ${version.version}` : title}
                  className="size-full bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-white p-8 text-center text-sm text-slate-500">
                  当前版本没有可加载的预览入口。
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
