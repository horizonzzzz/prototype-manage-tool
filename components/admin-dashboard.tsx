'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined, PoweroffOutlined, StarOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

import type { ApiResponse, ProductDetail, ProductListItem, ProductVersionItem, UploadRecordItem } from '@/lib/types';
import { getErrorMessage } from '@/lib/domain/error-message';
import { pageHeaderStyle, pageHeaderSubtitleStyle, pageHeaderTitleStyle } from '@/lib/ui/page-header';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

type UploadFormValues = {
  productKey: string;
  version: string;
  title?: string;
  remark?: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data as T;
}

function StatusTags({ version }: { version: ProductVersionItem }) {
  return (
    <Space wrap>
      <Tag color={version.status === 'published' ? 'blue' : 'default'}>{version.status}</Tag>
      {version.isDefault ? <Tag color="gold">默认版本</Tag> : null}
      {version.isLatest ? <Tag color="green">最新版本</Tag> : null}
    </Space>
  );
}

export function AdminDashboard() {
  const { message, modal } = App.useApp();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [records, setRecords] = useState<UploadRecordItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<UploadFile[]>([]);
  const [productForm] = Form.useForm();
  const [uploadForm] = Form.useForm();

  const loadProducts = async () => {
    const list = await fetchJson<ProductListItem[]>('/api/products');
    setProducts(list);
    setSelectedProductKey((current) => current ?? list[0]?.key);
  };

  const loadProductDetail = async (productKey: string) => {
    setLoading(true);
    try {
      const [detail, uploadRecords] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${productKey}`),
        fetchJson<UploadRecordItem[]>(`/api/products/${productKey}/versions?includeRecords=true`),
      ]);
      setProductDetail(detail);
      setRecords(uploadRecords);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductKey) {
      void loadProductDetail(selectedProductKey);
    }
  }, [selectedProductKey]);

  const filteredVersions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const source = productDetail?.versions ?? [];
    if (!keyword) {
      return source;
    }

    return source.filter((item) =>
      [item.version, item.title ?? '', item.remark ?? ''].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [productDetail, search]);

  const createProduct = async () => {
    const values = await productForm.validateFields();
    await fetchJson('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    message.success('产品创建成功');
    setCreateOpen(false);
    productForm.resetFields();
    await loadProducts();
  };

  const uploadVersion = async () => {
    try {
      setUploadError(undefined);
      const values = (await uploadForm.validateFields()) as UploadFormValues;
      const selectedFile = selectedUploadFiles[0]?.originFileObj;
      if (!selectedFile) {
        setUploadError('请上传 zip 文件');
        return;
      }
      const formData = new FormData();
      formData.set('productKey', values.productKey);
      formData.set('version', values.version);
      formData.set('title', values.title ?? '');
      formData.set('remark', values.remark ?? '');
      formData.set('file', selectedFile);
      setUploading(true);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/versions/upload');
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = async () => {
          const payload = JSON.parse(xhr.responseText) as ApiResponse<{ previewUrl: string }>;
          if (xhr.status >= 400 || !payload.success) {
            reject(new Error(payload.message || '上传失败'));
            return;
          }

          message.success('上传成功');
          uploadForm.resetFields();
          setSelectedUploadFiles([]);
          await loadProducts();
          await loadProductDetail(values.productKey);
          resolve();
        };
        xhr.onerror = () => reject(new Error('上传失败'));
        xhr.send(formData);
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, '上传失败');
      setUploadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const refreshCurrent = async () => {
    if (selectedProductKey) {
      await loadProducts();
      await loadProductDetail(selectedProductKey);
    }
  };

  const requestAction = async (url: string, successText: string) => {
    await fetchJson(url, { method: url.includes('/default') || url.includes('/offline') ? 'PATCH' : 'DELETE' });
    message.success(successText);
    await refreshCurrent();
  };

  return (
    <Layout className="page-shell">
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              产品列表
            </Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建
            </Button>
          </Space>
          <List
            bordered
            dataSource={products}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', background: item.key === selectedProductKey ? '#eef4ff' : undefined, borderRadius: 8, marginBottom: 8 }}
                onClick={() => setSelectedProductKey(item.key)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.name}</span>
                      <Tag>{item.key}</Tag>
                    </Space>
                  }
                  description={`${item.publishedCount} 个已发布版本`}
                />
              </List.Item>
            )}
          />
        </Space>
      </Sider>
      <Layout>
        <Header style={pageHeaderStyle}>
          <div>
            <Title level={3} style={pageHeaderTitleStyle}>
              原型发布管理台
            </Title>
            <Text type="secondary" style={pageHeaderSubtitleStyle}>
              上传 dist.zip、设默认版本、下线与删除
            </Text>
          </div>
        </Header>
        <Content style={{ padding: 24 }}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="上传新版本" loading={loading}>
                <Form form={uploadForm} layout="vertical">
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item name="productKey" label="产品" rules={[{ required: true, message: '请选择产品' }]}>
                        <Select options={products.map((item) => ({ label: `${item.name} (${item.key})`, value: item.key }))} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                        <Input placeholder="例如 v1.0.0" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="title" label="版本标题">
                        <Input placeholder="可选" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="remark" label="更新说明">
                    <Input.TextArea rows={3} placeholder="可选" />
                  </Form.Item>
                  <Form.Item
                    label="dist.zip"
                  >
                    <Upload.Dragger
                      beforeUpload={() => false}
                      accept=".zip"
                      maxCount={1}
                      fileList={selectedUploadFiles}
                      onChange={({ fileList }) => {
                        setSelectedUploadFiles(fileList.slice(-1));
                        if (uploadError) {
                          setUploadError(undefined);
                        }
                      }}
                      onRemove={() => {
                        setSelectedUploadFiles([]);
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p>拖拽或点击上传 dist.zip</p>
                      <p className="ant-upload-hint">平台要求构建产物使用相对资源路径</p>
                    </Upload.Dragger>
                  </Form.Item>
                </Form>
                {uploading ? <Progress percent={uploadProgress} status="active" /> : null}
                {uploadError ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="上传失败"
                    description={uploadError}
                  />
                ) : null}
                <Button type="primary" onClick={() => void uploadVersion()} loading={uploading}>
                  上传并发布
                </Button>
              </Card>
            </Col>
            <Col xs={24} xl={15}>
              <Card
                title="版本列表"
                extra={<Input.Search allowClear placeholder="搜索版本号或标题" style={{ width: 280 }} onChange={(event) => setSearch(event.target.value)} />}
                loading={loading}
              >
                <Table<ProductVersionItem>
                  rowKey="id"
                  pagination={false}
                  dataSource={filteredVersions}
                  columns={[
                    { title: '版本', dataIndex: 'version', key: 'version', width: 120 },
                    {
                      title: '标题 / 备注',
                      key: 'meta',
                      render: (_, item) => (
                        <div>
                          <div>{item.title || '—'}</div>
                          <Text type="secondary">{item.remark || '无备注'}</Text>
                        </div>
                      ),
                    },
                    { title: '状态', key: 'status', width: 180, render: (_, item) => <StatusTags version={item} /> },
                    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
                    {
                      title: '操作',
                      key: 'actions',
                      width: 240,
                      render: (_, item) => (
                        <Space wrap>
                          <Button size="small" icon={<StarOutlined />} disabled={item.isDefault} onClick={() => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}>
                            设默认
                          </Button>
                          <Button size="small" icon={<PoweroffOutlined />} disabled={item.status === 'offline'} onClick={() => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}>
                            下线
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              modal.confirm({
                                title: `删除版本 ${item.version}`,
                                content: '删除后会同步移除静态目录，请确认。',
                                okText: '删除',
                                okButtonProps: { danger: true },
                                onOk: async () => requestAction(`/api/versions/${item.id}`, '版本已删除'),
                              })
                            }
                          >
                            删除
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={9}>
              <Card title="失败记录" loading={loading}>
                <List
                  locale={{ emptyText: '暂无失败记录' }}
                  dataSource={records.filter((item) => item.status === 'failed')}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <span>{item.version}</span>
                            <Tag color="error">failed</Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <div>{item.fileName}</div>
                            <Text type="secondary">{item.errorMessage || '未知错误'}</Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
              <Divider />
              <Card title="当前产品信息" loading={loading}>
                {productDetail ? (
                  <Space direction="vertical" size="small">
                    <Text strong>{productDetail.name}</Text>
                    <Text type="secondary">Key: {productDetail.key}</Text>
                    <Paragraph className="muted" style={{ marginBottom: 0 }}>
                      {productDetail.description || '暂无描述'}
                    </Paragraph>
                  </Space>
                ) : (
                  <div className="empty-state">请选择产品</div>
                )}
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>

      <Modal title="新建产品" open={createOpen} onOk={() => void createProduct()} onCancel={() => setCreateOpen(false)} okText="创建">
        <Form form={productForm} layout="vertical">
          <Form.Item name="key" label="产品 Key" rules={[{ required: true, message: '请输入产品 Key' }]}>
            <Input placeholder="例如 crm" />
          </Form.Item>
          <Form.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="例如 CRM 系统" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
