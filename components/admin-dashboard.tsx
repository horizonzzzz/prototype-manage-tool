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
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined, PoweroffOutlined, StarOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

import type { ApiResponse, BuildJobItem, ProductDetail, ProductListItem, ProductVersionItem } from '@/lib/types';
import { getErrorMessage } from '@/lib/domain/error-message';
import { pageHeaderStyle, pageHeaderSubtitleStyle, pageHeaderTitleStyle } from '@/lib/ui/page-header';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

type UploadFormValues = {
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

function getStatusTagColor(status: string) {
  switch (status) {
    case 'published':
    case 'success':
      return 'green';
    case 'building':
    case 'queued':
    case 'running':
      return 'blue';
    case 'failed':
      return 'error';
    case 'offline':
      return 'default';
    default:
      return 'default';
  }
}

function renderStatusTag(status: string, text = status) {
  return <Tag color={getStatusTagColor(status)}>{text}</Tag>;
}

function getStepStatus(stepStatus: string): 'wait' | 'process' | 'finish' | 'error' {
  switch (stepStatus) {
    case 'success':
      return 'finish';
    case 'running':
      return 'process';
    case 'failed':
      return 'error';
    default:
      return 'wait';
  }
}

function StatusTags({ version }: { version: ProductVersionItem }) {
  return (
    <Space wrap>
      {renderStatusTag(version.status)}
      {version.isDefault ? <Tag color="gold">默认版本</Tag> : null}
      {version.isLatest ? <Tag color="green">最新记录</Tag> : null}
    </Space>
  );
}

export function AdminDashboard() {
  const { message, modal } = App.useApp();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<UploadFile[]>([]);
  const [productForm] = Form.useForm();
  const [uploadForm] = Form.useForm();

  const syncJobs = (nextJobs: BuildJobItem[]) => {
    setJobs(nextJobs);
    const runningJob = nextJobs.find((item) => ['queued', 'running'].includes(item.status));
    if (runningJob) {
      setActiveJobId(runningJob.id);
      setActiveJob(runningJob);
    } else if (activeJobId && !nextJobs.some((item) => item.id === activeJobId)) {
      setActiveJobId(undefined);
      setActiveJob(null);
    }
  };

  const loadProducts = async () => {
    const list = await fetchJson<ProductListItem[]>('/api/products');
    setProducts(list);
    setSelectedProductKey((current) => current ?? list[0]?.key);
  };

  const loadProductDetail = async (productKey: string) => {
    setLoading(true);
    try {
      const [detail, buildJobs] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${productKey}`),
        fetchJson<BuildJobItem[]>(`/api/products/${productKey}/build-jobs`),
      ]);
      setProductDetail(detail);
      syncJobs(buildJobs);
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

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const job = await fetchJson<BuildJobItem>(`/api/build-jobs/${activeJobId}`);
        if (cancelled) {
          return;
        }

        setActiveJob(job);
        setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));

        if (!['queued', 'running'].includes(job.status)) {
          window.clearInterval(timer);
          if (selectedProductKey === job.productKey) {
            await loadProductDetail(job.productKey);
          }
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, selectedProductKey]);

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
      if (!selectedProductKey) {
        setUploadError('请先选择产品');
        return;
      }
      const selectedFile = selectedUploadFiles[0]?.originFileObj;
      if (!selectedFile) {
        setUploadError('请上传源码压缩包');
        return;
      }

      const formData = new FormData();
      formData.set('productKey', selectedProductKey);
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
          const payload = JSON.parse(xhr.responseText) as ApiResponse<BuildJobItem>;
          if (xhr.status >= 400 || !payload.success || !payload.data) {
            reject(new Error(payload.message || '上传失败'));
            return;
          }

          const buildJob = payload.data;
          message.success('源码包上传成功，后台任务已开始');
          uploadForm.resetFields();
          setSelectedUploadFiles([]);
          setActiveJobId(buildJob.id);
          setActiveJob(buildJob);
          await loadProducts();
          await loadProductDetail(selectedProductKey);
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
                style={{
                  cursor: 'pointer',
                  background: item.key === selectedProductKey ? '#eef4ff' : undefined,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
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
              上传源码压缩包，系统自动安装依赖、执行构建并发布 dist
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
                      <Form.Item label="产品" required>
                        <Select
                          value={selectedProductKey}
                          onChange={(value) => setSelectedProductKey(value)}
                          options={products.map((item) => ({ label: `${item.name} (${item.key})`, value: item.key }))}
                        />
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
                  <Form.Item label="源码压缩包">
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
                      <p>拖拽或点击上传源码 zip</p>
                      <p className="ant-upload-hint">压缩包内需包含 package.json 和 build 脚本，构建产物固定输出到 dist/</p>
                    </Upload.Dragger>
                  </Form.Item>
                </Form>
                {uploading ? <Progress percent={uploadProgress} status="active" style={{ marginBottom: 16 }} /> : null}
                {uploadError ? (
                  <Alert type="error" showIcon style={{ marginBottom: 16 }} message="上传失败" description={uploadError} />
                ) : null}
                <Button type="primary" onClick={() => void uploadVersion()} loading={uploading}>
                  上传并创建任务
                </Button>
                {activeJob ? (
                  <>
                    <Divider />
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Space wrap>
                        <Text strong>
                          当前任务：{activeJob.version} / {activeJob.fileName}
                        </Text>
                        {renderStatusTag(activeJob.status, activeJob.status)}
                      </Space>
                      <Progress
                        percent={activeJob.progressPercent}
                        status={activeJob.status === 'failed' ? 'exception' : activeJob.status === 'success' ? 'success' : 'active'}
                      />
                      <Alert
                        type={activeJob.status === 'failed' ? 'error' : activeJob.status === 'success' ? 'success' : 'info'}
                        showIcon
                        message={activeJob.logSummary || '任务执行中'}
                        description={activeJob.errorMessage || `当前步骤：${activeJob.currentStep ?? 'waiting'}`}
                      />
                      <Steps
                        direction="vertical"
                        size="small"
                        items={activeJob.steps.map((step) => ({
                          title: step.label,
                          status: getStepStatus(step.status),
                          description: step.message || '等待执行',
                        }))}
                      />
                    </Space>
                  </>
                ) : null}
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
                          <Button
                            size="small"
                            icon={<StarOutlined />}
                            disabled={item.isDefault || item.status !== 'published'}
                            onClick={() => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}
                          >
                            设默认
                          </Button>
                          <Button
                            size="small"
                            icon={<PoweroffOutlined />}
                            disabled={item.status !== 'published'}
                            onClick={() => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}
                          >
                            下线
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              modal.confirm({
                                title: `删除版本 ${item.version}`,
                                content: '删除后会同步移除已发布目录，请确认。',
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
              <Card title="最近任务" loading={loading}>
                <List
                  locale={{ emptyText: '暂无任务记录' }}
                  dataSource={jobs}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setActiveJobId(item.id);
                        setActiveJob(item);
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <span>{item.version}</span>
                            {renderStatusTag(item.status)}
                            <Text type="secondary">{item.progressPercent}%</Text>
                          </Space>
                        }
                        description={
                          <div>
                            <div>{item.fileName}</div>
                            <Text type="secondary">{item.errorMessage || item.logSummary || '等待执行'}</Text>
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
