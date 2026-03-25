'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Dropdown, Empty, Input, List, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  CopyOutlined,
  ExportOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';

import type { ApiResponse, ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { groupVersionsForPreview } from '@/lib/domain/preview';
import { buildAdminHref, buildPreviewHref } from '@/lib/ui/navigation';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';

const { Title, Text } = Typography;

type ManifestPayload = {
  products: ManifestProduct[];
  resolved: {
    productKey?: string;
    version?: string;
  };
};

async function fetchManifest(query: string) {
  const response = await fetch(`/api/manifest${query}`, { cache: 'no-store' });
  const payload = (await response.json()) as ApiResponse<ManifestPayload>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || '加载 manifest 失败');
  }

  return payload.data;
}

function renderVersionButtonContent(version: ProductVersionManifest) {
  return (
    <Space size={6}>
      <span>{version.version}</span>
      {version.isDefault ? <Tag className="status-chip status-offline">默认</Tag> : null}
      {version.isLatest ? <Tag className="status-chip status-running">最新</Tag> : null}
    </Space>
  );
}

export function PreviewBrowser() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ManifestProduct[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [productKeyword, setProductKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = searchParams.toString();
    setLoading(true);
    fetchManifest(query ? `?${query}` : '')
      .then((data) => {
        setProducts(data.products);
        setSelectedProductKey(data.resolved.productKey);
        setSelectedVersion(data.resolved.version);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const visibleProducts = useMemo(() => {
    const keyword = productKeyword.trim().toLowerCase();
    if (!keyword) {
      return products;
    }
    return products.filter((item) => [item.key, item.name].some((value) => value.toLowerCase().includes(keyword)));
  }, [productKeyword, products]);

  const currentProduct = products.find((item) => item.key === selectedProductKey) ?? visibleProducts[0];
  const versions = currentProduct?.versions ?? [];
  const currentVersion =
    versions.find((item) => item.version === selectedVersion) ??
    versions.find((item) => item.version === currentProduct?.defaultVersion) ??
    versions[0];
  const groupedVersions = useMemo(
    () => groupVersionsForPreview(versions, currentVersion?.version),
    [currentVersion?.version, versions],
  );

  const syncUrl = (productKey: string, version: string) => {
    setSelectedProductKey(productKey);
    setSelectedVersion(version);
    router.replace(buildPreviewHref(productKey, version));
  };

  const resolveCurrentPreviewLink = () => {
    if (!currentVersion?.entryUrl || typeof window === 'undefined') {
      return undefined;
    }

    return resolvePreviewEntryUrl(currentVersion.entryUrl, window.location.origin);
  };

  const copyLink = async () => {
    if (!currentProduct || !currentVersion) {
      return;
    }

    const target = resolveCurrentPreviewLink();
    if (!target) {
      return;
    }

    const copied = await copyText(target);
    if (copied) {
      message.success('预览页链接已复制');
      return;
    }

    message.error('当前环境不支持自动复制，请手动复制预览地址');
  };

  const openNewWindow = () => {
    const target = resolveCurrentPreviewLink();
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  const overflowVersionItems = useMemo<MenuProps['items']>(() => {
    if (!currentProduct) {
      return [];
    }

    return groupedVersions.overflowVersions.map((item) => ({
      key: item.version,
      label: renderVersionButtonContent(item),
      onClick: () => syncUrl(currentProduct.key, item.version),
    }));
  }, [currentProduct, groupedVersions.overflowVersions]);

  return (
    <div className="page-shell" style={{ display: 'flex' }}>
      <aside className="page-sidebar" style={{ width: 264, minHeight: '100vh' }}>
        <div className="page-sidebar-inner">
          <div>
            <h1 className="page-sidebar-title" style={{ marginBottom: 12 }}>
              产品原型
            </h1>
            <Input.Search
              allowClear
              className="page-sidebar-search"
              prefix={<SearchOutlined />}
              placeholder="按产品名称搜索"
              onChange={(event) => setProductKeyword(event.target.value)}
            />
          </div>

          <List
            className="admin-side-list"
            loading={loading}
            locale={{ emptyText: '暂无可预览产品' }}
            dataSource={visibleProducts}
            renderItem={(item) => (
              <List.Item style={{ border: 'none', padding: 0 }}>
                <div
                  className={`admin-product-list-item-content`}
                  style={{ width: '100%', cursor: 'pointer' }}
                  onClick={() => {
                    const nextVersion = item.defaultVersion ?? item.versions[0]?.version;
                    if (nextVersion) {
                      syncUrl(item.key, nextVersion);
                    }
                  }}
                >
                  <div className={`admin-product-list-item-main${item.key === currentProduct?.key ? ' is-selected' : ''}`}>
                    <div className="admin-product-list-item-header">
                      <div className="admin-product-list-item-title">
                        <span className="admin-product-list-item-title-text">{item.name}</span>
                      </div>
                      <Tag className="admin-product-list-item-key-tag">{item.key}</Tag>
                    </div>
                    <span className="admin-product-list-item-description">{item.versions.length} 个已发布版本</span>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </aside>

      <main className="page-main" style={{ flex: 1, minWidth: 0 }}>
        <header className="page-topbar">
          <div>
            <Title level={3} className="page-topbar-title" style={{ fontSize: 20 }}>
              前端原型统一预览台
            </Title>
            <Text className="page-topbar-subtitle">按产品 / 版本切换预览</Text>
          </div>
          <div className="page-topbar-actions">
            <Button className="subtle-button" onClick={() => router.push(buildAdminHref(currentProduct?.key))}>
              前往管理台
            </Button>
            <Button className="subtle-button" icon={<CopyOutlined />} onClick={() => void copyLink()} disabled={!currentVersion}>
              复制预览链接
            </Button>
            <Button className="subtle-button" icon={<ExportOutlined />} onClick={openNewWindow} disabled={!currentVersion}>
              新窗口打开
            </Button>
            <Button className="subtle-button" icon={<ReloadOutlined />} onClick={() => router.refresh()}>
              刷新
            </Button>
          </div>
        </header>

        <div className="page-main-scroll">
          <div className="preview-toolbar">
            <div>
              <h3 className="preview-title">
                {currentProduct ? `${currentProduct.name} / 版本列表` : '暂无可预览版本'}
              </h3>
              <div className="preview-meta">
                <div className="preview-version-code">{currentVersion?.version ?? '—'}</div>
                <div className="preview-version-remark">{currentVersion?.remark || '暂无更新说明'}</div>
              </div>
            </div>

            <div className="preview-version-pillbar">
              {groupedVersions.visibleVersions.map((item: ProductVersionManifest) => (
                <Button
                  key={item.version}
                  className={`preview-version-pill${currentVersion?.version === item.version ? ' is-active' : ''}`}
                  onClick={() => syncUrl(currentProduct.key, item.version)}
                >
                  {renderVersionButtonContent(item)}
                </Button>
              ))}
              {groupedVersions.overflowVersions.length ? (
                <Dropdown trigger={['click']} menu={{ items: overflowVersionItems }}>
                  <Button className="subtle-button" icon={<MoreOutlined />}>
                    更多版本
                  </Button>
                </Dropdown>
              ) : null}
            </div>
          </div>

          <div className="preview-frame">
            <div className="preview-frame-chrome">
              <div className="preview-frame-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-frame-status">Preview Active</div>
            </div>

            {currentVersion?.entryUrl ? (
              <iframe className="preview-iframe" src={currentVersion.entryUrl} title={`${currentProduct?.name}-${currentVersion.version}`} />
            ) : (
              <div className="empty-state">
                <Empty description="暂无可预览版本" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
