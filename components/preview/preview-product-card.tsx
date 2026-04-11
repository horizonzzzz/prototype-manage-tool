'use client';

import { Copy, ExternalLink, MonitorPlay } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';

type PreviewProductCardProps = {
  product: ManifestProduct;
  selectedVersion: ProductVersionManifest | undefined;
  onCopyLink: () => void;
  onOpenInNewWindow: () => void;
  onOpenViewer: () => void;
  onVersionChange: (value: string) => void;
};

export function PreviewProductCard({
  product,
  selectedVersion,
  onCopyLink,
  onOpenInNewWindow,
  onOpenViewer,
  onVersionChange,
}: PreviewProductCardProps) {
  const t = useTranslations('preview.card');
  const summary = product.description || t('noDescription');

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="bg-slate-50/50 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-xl">{product.name}</CardTitle>
            <CardDescription className="mt-1 truncate font-mono text-xs">{product.key}</CardDescription>
          </div>
          {product.versions.length ? (
            <Select value={selectedVersion?.version} onValueChange={onVersionChange}>
              <SelectTrigger size="sm" className="w-[100px] bg-white text-xs">
                <SelectValue className="block truncate text-left" placeholder={t('selectVersion')} />
              </SelectTrigger>
              <SelectContent>
                {product.versions.map((version) => (
                  <SelectItem key={version.version} value={version.version}>
                    {version.version}
                    {version.isDefault ? t('defaultSuffix') : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">{t('noVersions')}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        <p className="line-clamp-2 text-sm text-slate-600">{summary}</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <span>{t('publishedCount', { count: product.versions.length })}</span>
          {selectedVersion ? (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{t('currentVersion', { version: selectedVersion.version })}</span>
            </>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="gap-2 border-t bg-slate-50/50 p-4">
        <Button type="button" className="flex-1" disabled={!selectedVersion} onClick={onOpenViewer}>
          <MonitorPlay className="mr-2 h-4 w-4" />
          {t('preview')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!selectedVersion}
          onClick={onCopyLink}
          title={t('copyLink')}
          aria-label={t('copyLink')}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!selectedVersion}
          onClick={onOpenInNewWindow}
          title={t('openInNewWindow')}
          aria-label={t('openInNewWindow')}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
