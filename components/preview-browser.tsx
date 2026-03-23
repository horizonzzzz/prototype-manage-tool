'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Dropdown, Empty, Input, Layout, List, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { CopyOutlined, ExportOutlined, MoreOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';

import { groupVersionsForPreview } from '@/lib/domain/preview';
import type { ApiResponse, ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { buildAdminHref, buildPreviewHref } from '@/lib/ui/navigation';
import { pageHeaderStyle, pageHeaderSubtitleStyle, pageHeaderTitleStyle } from '@/lib/ui/page-header';

const { Header, Sider, Content } = Layout;
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
    <Space size={4}>
      <span>{version.version}</span>
      {version.isDefault ? <Tag color="gold">默认</Tag> : null}
      {version.isLatest ? <Tag color="green">最新</Tag> : null}
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

  const copyLink = async () => {
    if (!currentProduct || !currentVersion) {
      return;
    }
    const target = `${window.location.origin}${buildPreviewHref(currentProduct.key, currentVersion.version)}`;
    await navigator.clipboard.writeText(target);
    message.success('预览链接已复制');
  };

  const openNewWindow = () => {
    if (currentVersion?.entryUrl) {
      window.open(currentVersion.entryUrl, '_blank', 'noopener,noreferrer');
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
    <Layout className="page-shell">
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>
              产品原型
            </Title>
            <Input.Search allowClear placeholder="按产品名称搜索" onChange={(event) => setProductKeyword(event.target.value)} />
          </div>
          <List
            bordered
            loading={loading}
            locale={{ emptyText: '暂无可预览产品' }}
            dataSource={visibleProducts}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', background: item.key === currentProduct?.key ? '#eef4ff' : undefined, borderRadius: 8, marginBottom: 8 }}
                onClick={() => {
                  const nextVersion = item.defaultVersion ?? item.versions[0]?.version;
                  if (nextVersion) {
                    syncUrl(item.key, nextVersion);
                  }
                }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.name}</span>
                      <Tag>{item.key}</Tag>
                    </Space>
                  }
                  description={`${item.versions.length} 个已发布版本`}
                />
              </List.Item>
            )}
          />
        </Space>
      </Sider>
      <Layout>
        <Header style={{ ...pageHeaderStyle, justifyContent: 'space-between' }}>
          <div>
            <Title level={3} style={pageHeaderTitleStyle}>
              前端原型统一预览台
            </Title>
            <Text type="secondary" style={pageHeaderSubtitleStyle}>
              按产品 / 版本切换预览
            </Text>
          </div>
          <Space>
            <Button onClick={() => router.push(buildAdminHref(currentProduct?.key))}>
              前往管理台
            </Button>
            <Button icon={<CopyOutlined />} onClick={() => void copyLink()} disabled={!currentVersion}>
              复制预览链接
            </Button>
            <Button icon={<ExportOutlined />} onClick={openNewWindow} disabled={!currentVersion}>
              新窗口打开
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => router.refresh()}>
              刷新
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Card
            title={currentProduct ? `${currentProduct.name} / 版本列表` : '暂无可预览版本'}
            extra={
              <Space wrap size={[8, 8]}>
                {groupedVersions.visibleVersions.map((item: ProductVersionManifest) => (
                  <Button key={item.version} type={currentVersion?.version === item.version ? 'primary' : 'default'} onClick={() => syncUrl(currentProduct.key, item.version)}>
                    {renderVersionButtonContent(item)}
                  </Button>
                ))}
                {groupedVersions.overflowVersions.length ? (
                  <Dropdown trigger={['click']} menu={{ items: overflowVersionItems }}>
                    <Button icon={<MoreOutlined />}>更多版本</Button>
                  </Dropdown>
                ) : null}
              </Space>
            }
          >
            {currentVersion?.entryUrl ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text strong>{currentVersion.title || currentVersion.version}</Text>
                  <br />
                  <Text type="secondary">{currentVersion.remark || '暂无更新说明'}</Text>
                </div>
                <iframe className="preview-iframe" src={currentVersion.entryUrl} title={`${currentProduct?.name}-${currentVersion.version}`} />
              </Space>
            ) : (
              <div className="empty-state">
                <Empty description="暂无可预览版本" />
              </div>
            )}
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
}
