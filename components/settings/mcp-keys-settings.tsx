'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { McpApiKeyItem } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';

type AvailableProduct = {
  id: number;
  key: string;
  name: string;
};

type McpKeysSettingsProps = {
  title: string;
  description: string;
  initialKeys: McpApiKeyItem[];
  availableProducts: AvailableProduct[];
};

const EXPIRATION_OPTIONS = ['7d', '30d', '90d', '1y', 'permanent'] as const;
type ExpirationOption = (typeof EXPIRATION_OPTIONS)[number];

function resolveExpiresAt(option: ExpirationOption) {
  if (option === 'permanent') {
    return null;
  }

  const now = dayjs();
  switch (option) {
    case '7d':
      return now.add(7, 'day').toISOString();
    case '30d':
      return now.add(30, 'day').toISOString();
    case '90d':
      return now.add(90, 'day').toISOString();
    case '1y':
      return now.add(1, 'year').toISOString();
    default:
      return null;
  }
}

export function McpKeysSettings({ title, description, initialKeys, availableProducts }: McpKeysSettingsProps) {
  const t = useTranslations('mcp');
  const tCommon = useTranslations('common');
  const [keys, setKeys] = useState(initialKeys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<McpApiKeyItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [expirationOption, setExpirationOption] = useState<ExpirationOption>('permanent');

  const allSelected = availableProducts.length > 0 && selectedProductIds.length === availableProducts.length;

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success(t('mcpTokenCopied'));
    } catch {
      toast.error(t('mcpTokenCopyFailed'));
    }
  }

  function resetCreateForm() {
    setName('');
    setSelectedProductIds([]);
    setExpirationOption('permanent');
    setSubmitting(false);
  }

  function toggleProduct(productId: number) {
    setSelectedProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  function toggleSelectAll() {
    setSelectedProductIds(allSelected ? [] : availableProducts.map((product) => product.id));
  }

  async function createKey() {
    if (!name.trim()) {
      toast.error(t('mcpNameRequired'));
      return;
    }

    if (!selectedProductIds.length) {
      toast.error(t('mcpProductsRequired'));
      return;
    }

    try {
      setSubmitting(true);
      const created = await fetchJson<McpApiKeyItem>('/api/mcp/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          productIds: selectedProductIds,
          expiresAt: resolveExpiresAt(expirationOption),
        }),
      });

      setKeys((current) => [created, ...current]);
      setDialogOpen(false);
      resetCreateForm();
      toast.success(t('mcpCreateSuccess'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcpCreateError'));
      setSubmitting(false);
    }
  }

  async function deleteKey() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      await fetchJson<null>(`/api/mcp/keys/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setKeys((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(t('mcpDeleteSuccess'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcpDeleteError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('mcpCreate')}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('mcpColumns.name')}</TableHead>
              <TableHead>{t('mcpColumns.token')}</TableHead>
              <TableHead>{t('mcpColumns.products')}</TableHead>
              <TableHead>{t('mcpColumns.expiresAt')}</TableHead>
              <TableHead>{t('mcpColumns.createdAt')}</TableHead>
              <TableHead className="text-right">{t('mcpColumns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {t('mcpEmpty')}
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{key.tokenPreview}</code>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void copyToken(key.token)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.products.map((product) => (
                        <Badge key={product.id} variant="secondary">
                          {product.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.expiresAt ? dayjs(key.expiresAt).format('YYYY-MM-DD') : t('mcpPermanent')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dayjs(key.createdAt).format('YYYY-MM-DD')}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mcpCreate')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="mcp-key-name">{t('mcpNameLabel')}</Label>
              <Input id="mcp-key-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mcp-key-expiration">{t('mcpExpirationLabel')}</Label>
              <Select value={expirationOption} onValueChange={(value) => setExpirationOption(value as ExpirationOption)}>
                <SelectTrigger id="mcp-key-expiration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">{t('mcpExpirationOptions.7d')}</SelectItem>
                  <SelectItem value="30d">{t('mcpExpirationOptions.30d')}</SelectItem>
                  <SelectItem value="90d">{t('mcpExpirationOptions.90d')}</SelectItem>
                  <SelectItem value="1y">{t('mcpExpirationOptions.1y')}</SelectItem>
                  <SelectItem value="permanent">{t('mcpExpirationOptions.permanent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('mcpProductsLabel')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAll}>
                  {allSelected ? t('mcpClearSelection') : t('mcpSelectAll')}
                </Button>
              </div>
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border p-4">
                {availableProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('mcpNoProducts')}</p>
                ) : (
                  availableProducts.map((product) => (
                    <label key={product.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span>{product.name}</span>
                      <span className="text-muted-foreground">({product.key})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void createKey()}
              disabled={submitting || !availableProducts.length || !name.trim() || !selectedProductIds.length}
            >
              {t('mcpCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={deleteTarget ? t('mcpDeleteTitleWithName', { name: deleteTarget.name }) : t('mcpDeleteTitle')}
        description={t('mcpDeleteDescription')}
        confirmLabel={t('mcpDeleteConfirm')}
        confirmVariant="destructive"
        pending={deleting}
        onConfirm={() => void deleteKey()}
      />
    </div>
  );
}
