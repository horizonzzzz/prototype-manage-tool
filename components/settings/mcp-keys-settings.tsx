'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { CircleHelp, Copy, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  mcpEndpointUrl: string;
};

const EXPIRATION_OPTIONS = ['7d', '30d', '90d', '1y', 'permanent'] as const;
type ExpirationOption = (typeof EXPIRATION_OPTIONS)[number];
const MCP_SERVER_NAME = 'prototype-manage-tool';
const MCP_TOKEN_PLACEHOLDER = '<YOUR_MCP_TOKEN>';
const MCP_AUTHORIZATION_HEADER = `Authorization: Bearer ${MCP_TOKEN_PLACEHOLDER}`;

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

function renderCodeBlock(language: string, value: string) {
  return [`\`\`\`${language}`, value, '```'].join('\n');
}

function renderJsonBlock(value: object) {
  return renderCodeBlock('json', JSON.stringify(value, null, 2));
}

function buildHelpMarkdown(t: ReturnType<typeof useTranslations<'mcp'>>, mcpEndpointUrl: string) {
  const claudeConfig = {
    type: 'http',
    url: mcpEndpointUrl,
    headers: {
      Authorization: `Bearer ${MCP_TOKEN_PLACEHOLDER}`,
    },
  };

  const cursorConfig = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        url: mcpEndpointUrl,
        headers: {
          Authorization: `Bearer ${MCP_TOKEN_PLACEHOLDER}`,
        },
      },
    },
  };

  const geminiConfig = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        httpUrl: mcpEndpointUrl,
        headers: {
          Authorization: `Bearer ${MCP_TOKEN_PLACEHOLDER}`,
        },
      },
    },
  };

  const opencodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      [MCP_SERVER_NAME]: {
        type: 'remote',
        url: mcpEndpointUrl,
        headers: {
          Authorization: `Bearer ${MCP_TOKEN_PLACEHOLDER}`,
        },
      },
    },
  };

  const genericConfig = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: 'http',
        url: mcpEndpointUrl,
        headers: {
          Authorization: `Bearer ${MCP_TOKEN_PLACEHOLDER}`,
        },
      },
    },
  };

  const claudeJsonArgument = JSON.stringify(claudeConfig);

  return [
    `## ${t('helpSections.prerequisitesTitle')}`,
    t('helpSections.prerequisitesBody'),
    '',
    `- ${t('helpSections.prerequisitesItems.createKey')}`,
    `- ${t('helpSections.prerequisitesItems.endpoint')}`,
    `- ${t('helpSections.prerequisitesItems.token')} \`${MCP_AUTHORIZATION_HEADER}\``,
    '',
    `## ${t('helpSections.endpointTitle')}`,
    t('helpSections.endpointBody'),
    '',
    renderCodeBlock('text', mcpEndpointUrl),
    '',
    `## ${t('helpSections.clientsTitle')}`,
    t('helpSections.clientsBody'),
    '',
    '### Claude Code',
    t('helpAgents.claudeDescription'),
    '',
    renderCodeBlock('bash', `claude mcp add-json ${MCP_SERVER_NAME} '${claudeJsonArgument}'`),
    '',
    '### Cursor',
    t('helpAgents.cursorDescription'),
    '',
    renderJsonBlock(cursorConfig),
    '',
    '### Gemini CLI',
    t('helpAgents.geminiDescription'),
    '',
    renderJsonBlock(geminiConfig),
    '',
    '### OpenCode',
    t('helpAgents.opencodeDescription'),
    '',
    renderJsonBlock(opencodeConfig),
    '',
    `## ${t('helpSections.genericTitle')}`,
    t('helpSections.genericBody'),
    '',
    renderJsonBlock(genericConfig),
    '',
    t('helpSections.genericFooter'),
  ].join('\n');
}

export function McpKeysSettings({ title, description, initialKeys, availableProducts, mcpEndpointUrl }: McpKeysSettingsProps) {
  const t = useTranslations('mcp');
  const tCommon = useTranslations('common');
  const [keys, setKeys] = useState(initialKeys);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<McpApiKeyItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [expirationOption, setExpirationOption] = useState<ExpirationOption>('permanent');
  const helpMarkdown = buildHelpMarkdown(t, mcpEndpointUrl);

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
      setCreateDialogOpen(false);
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('helpOpen')}
            title={t('helpOpen')}
            onClick={() => setHelpDialogOpen(true)}
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('mcpCreate')}
          </Button>
        </div>
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
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
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
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
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

      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle>{t('helpTitle')}</DialogTitle>
            <DialogDescription>{t('helpDescription')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="rounded-lg border bg-muted/30 p-4">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className="mt-5 first:mt-0 text-base font-semibold text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="mt-2 leading-6 text-muted-foreground">{children}</p>,
                  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{children}</ul>,
                  li: ({ children }) => <li>{children}</li>,
                  pre: ({ children }) => <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-6">{children}</pre>,
                  code: ({ className, children }) => {
                    const isBlock = Boolean(className);

                    if (isBlock) {
                      return <code className={className}>{children}</code>;
                    }

                    return <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
                  },
                }}
              >
                {helpMarkdown}
              </ReactMarkdown>
            </div>
          </div>
          <div className="flex shrink-0 justify-end border-t bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setHelpDialogOpen(false)}>
              {t('helpClose')}
            </Button>
          </div>
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
