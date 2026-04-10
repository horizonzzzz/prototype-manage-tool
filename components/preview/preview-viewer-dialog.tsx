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
  desktop: 'w-full h-full rounded-none border-0',
  tablet:
    'w-[768px] h-[1024px] border-8 border-slate-800 rounded-3xl shadow-2xl overflow-hidden',
  mobile:
    'w-[375px] h-[812px] border-[12px] border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden',
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
        className="top-0 left-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:max-w-none"
      >
        <div className="flex h-full w-full flex-col bg-slate-100 overflow-hidden">
          <div className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm shrink-0 z-10">
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
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <Button
                  type="button"
                  variant={device === 'desktop' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor />
                  <span className="sr-only">桌面端视图</span>
                </Button>
                <Button
                  type="button"
                  variant={device === 'tablet' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDevice('tablet')}
                >
                  <Tablet />
                  <span className="sr-only">平板端视图</span>
                </Button>
                <Button
                  type="button"
                  variant={device === 'mobile' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
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

          <div className="flex flex-1 items-center justify-center overflow-auto p-4 md:p-8 bg-slate-100/50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
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
