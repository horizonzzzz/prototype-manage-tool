'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  SearchOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { AdminProductListItem } from '@/components/admin-product-list-item';
import { BuildJobStepList } from '@/components/build-job-step-list';
import { BuildJobTerminal } from '@/components/build-job-terminal';
import { getErrorMessage } from '@/lib/domain/error-message';
import type {
  ApiResponse,
  BuildJobItem,
  BuildJobLogItem,
  BuildJobLogStreamEvent,
  BuildJobStepKey,
  ProductDetail,
  ProductListItem,
  ProductVersionItem,
} from '@/lib/types';
import { buildPreviewHref, resolveAdminProductKey } from '@/lib/ui/navigation';
import {
  applyBuildJobLogStreamEvent,
  buildBuildJobLogStreamUrl,
  buildBuildJobStageText,
  getBuildJobLogStep,
  isBuildJobLogStreamStep,
  shouldStreamBuildJobLog,
} from '@/lib/ui/build-job-log';

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

function getStatusTagClass(status: string) {
  switch (status) {
    case 'published':
    case 'success':
      return 'status-success';
    case 'building':
    case 'queued':
    case 'running':
      return 'status-running';
    case 'failed':
      return 'status-failed';
    case 'offline':
      return 'status-offline';
    default:
      return 'status-offline';
  }
}

function renderStatusTag(status: string, text = status) {
  return <Tag className={`status-chip ${getStatusTagClass(status)}`}>{text}</Tag>;
}

function getTerminalEmptyText(activeJob: BuildJobItem | null) {
  if (!activeJob) {
    return 'Waiting for build job selection...';
  }

  return activeJob.logSummary || 'No terminal output for the current step.';
}

function StatusTags({ version }: { version: ProductVersionItem }) {
  return (
    <Space wrap size={[6, 6]}>
      {renderStatusTag(version.status)}
      {version.isDefault ? <Tag className="status-chip status-offline">默认版本</Tag> : null}
      {version.isLatest ? <Tag className="status-chip status-running">最新记录</Tag> : null}
    </Space>
  );
}

export function AdminDashboard() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [activeJobLog, setActiveJobLog] = useState<BuildJobLogItem | null>(null);
  const [selectedLogStepKey, setSelectedLogStepKey] = useState<BuildJobStepKey | null>(null);
  const [isLogStepPinned, setIsLogStepPinned] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<UploadFile[]>([]);
  const [productForm] = Form.useForm();
  const [uploadForm] = Form.useForm();

  const clearProductContext = () => {
    setProductDetail(null);
    setJobs([]);
    setActiveJobId(undefined);
    setActiveJob(null);
    setActiveJobLog(null);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
  };

  const syncJobs = (nextJobs: BuildJobItem[]) => {
    setJobs(nextJobs);
    const runningJob = nextJobs.find((item) => ['queued', 'running'].includes(item.status));
    if (runningJob) {
      setActiveJobId(runningJob.id);
      setActiveJob(runningJob);
      return;
    }

    setActiveJob((current) => current ? nextJobs.find((item) => item.id === current.id) ?? current : null);
    if (activeJobId && !nextJobs.some((item) => item.id === activeJobId)) {
      setActiveJobId(undefined);
    }
  };

  const loadProducts = async () => {
    const list = await fetchJson<ProductListItem[]>('/api/products');
    setProducts(list);
  };

  const replaceProductQuery = (productKey?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (productKey) {
      next.set('product', productKey);
    } else {
      next.delete('product');
    }

    const currentQuery = searchParams.toString();
    const nextQuery = next.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    if (currentUrl !== nextUrl) {
      router.replace(nextUrl);
    }
  };

  const handleProductChange = (productKey: string) => {
    setSelectedProductKey(productKey);
    replaceProductQuery(productKey);
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
    const resolvedProductKey = resolveAdminProductKey(
      products.map((item) => item.key),
      searchParams.get('product'),
    );

    setSelectedProductKey((current) => (current === resolvedProductKey ? current : resolvedProductKey));

    if (resolvedProductKey !== searchParams.get('product')) {
      replaceProductQuery(resolvedProductKey);
    }
  }, [products, searchParams]);

  useEffect(() => {
    if (selectedProductKey) {
      void loadProductDetail(selectedProductKey);
      return;
    }

    clearProductContext();
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

  useEffect(() => {
    if (!activeJob) {
      setSelectedLogStepKey(null);
      setIsLogStepPinned(false);
      return;
    }

    const currentStep = getBuildJobLogStep(activeJob.currentStep);
    if (!isLogStepPinned || !selectedLogStepKey) {
      setSelectedLogStepKey(currentStep);
      return;
    }

    if (!activeJob.steps.some((step) => step.key === selectedLogStepKey)) {
      setSelectedLogStepKey(currentStep);
      setIsLogStepPinned(false);
    }
  }, [activeJob, isLogStepPinned, selectedLogStepKey]);

  useEffect(() => {
    if (!activeJobId || !activeJob) {
      setActiveJobLog(null);
      return;
    }

    const logStep = selectedLogStepKey ? getBuildJobLogStep(selectedLogStepKey) : getBuildJobLogStep(activeJob.currentStep);
    if (!logStep) {
      setActiveJobLog(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;

    const loadLog = async () => {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${activeJobId}/logs?step=${logStep}`);
        if (!cancelled) {
          setActiveJobLog(payload);
        }
      } catch {
        if (!cancelled) {
          setActiveJobLog({
            step: logStep,
            content: '',
            exists: false,
            updatedAt: null,
          });
        }
      }
    };

    if (shouldStreamBuildJobLog(activeJob, logStep) && isBuildJobLogStreamStep(logStep) && typeof EventSource !== 'undefined') {
      const connectStream = async () => {
        await loadLog();
        if (cancelled) {
          return;
        }

        eventSource = new EventSource(buildBuildJobLogStreamUrl(activeJobId, logStep));

        const handleStreamEvent = (messageEvent: MessageEvent<string>) => {
          if (cancelled) {
            return;
          }

          const event = JSON.parse(messageEvent.data) as BuildJobLogStreamEvent;
          setActiveJobLog((current) => applyBuildJobLogStreamEvent(current, event));

          if (event.type === 'status' && event.done) {
            eventSource?.close();
            eventSource = null;
          }
        };

        eventSource.addEventListener('snapshot', handleStreamEvent as EventListener);
        eventSource.addEventListener('chunk', handleStreamEvent as EventListener);
        eventSource.addEventListener('status', handleStreamEvent as EventListener);
        eventSource.addEventListener('heartbeat', handleStreamEvent as EventListener);
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      };
      void connectStream();

      return () => {
        cancelled = true;
        eventSource?.close();
      };
    }

    void loadLog();

    if (['queued', 'running'].includes(activeJob.status)) {
      timer = window.setInterval(() => {
        void loadLog();
      }, 1500);
    }

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      eventSource?.close();
    };
  }, [activeJob, activeJobId, selectedLogStepKey]);

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
          setSelectedLogStepKey(getBuildJobLogStep(buildJob.currentStep));
          setIsLogStepPinned(false);
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

  const handleDeleteProduct = async (productKey: string) => {
    await fetchJson(`/api/products/${productKey}`, { method: 'DELETE' });
    message.success('产品已删除');

    if (selectedProductKey === productKey) {
      setSelectedProductKey(undefined);
      clearProductContext();
    }

    await loadProducts();
  };

  const terminalEmptyText = getTerminalEmptyText(activeJob);
  const selectedStep = activeJob?.steps.find((step) => step.key === selectedLogStepKey) ?? null;
  const terminalContent = activeJobLog?.exists
    ? activeJobLog.content
    : activeJob && selectedStep
      ? buildBuildJobStageText(activeJob, selectedStep)
      : '';

  return (
    <div className="page-shell" style={{ display: 'flex' }}>
      <aside className="page-sidebar" style={{ width: 288, minHeight: '100vh' }}>
        <div className="page-sidebar-inner">
          <div className="page-sidebar-header">
            <h1 className="page-sidebar-title">产品列表</h1>
            <Button className="hero-button" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建
            </Button>
          </div>
          <List
            className="admin-side-list"
            locale={{ emptyText: '暂无产品' }}
            dataSource={products}
            renderItem={(item) => (
              <AdminProductListItem
                item={item}
                selected={item.key === selectedProductKey}
                onSelect={handleProductChange}
                onDelete={(product) => {
                  modal.confirm({
                    title: `删除产品 ${product.name}`,
                    content: '删除后会移除该产品下的所有版本、任务记录和已发布文件，请确认。',
                    okText: '删除',
                    okButtonProps: { danger: true },
                    onOk: async () => handleDeleteProduct(product.key),
                  });
                }}
              />
            )}
          />
        </div>
      </aside>

      <main className="page-main" style={{ flex: 1, minWidth: 0 }}>
        <header className="page-topbar">
          <div>
            <Title level={3} className="page-topbar-title">
              原型发布管理台
            </Title>
            <Text className="page-topbar-subtitle">上传源码压缩包，系统自动安装依赖、执行构建并发布 dist</Text>
          </div>
          <div className="page-topbar-actions">
            <Button
              className="subtle-button"
              icon={<PlayCircleOutlined style={{ color: '#2563eb' }} />}
              onClick={() => router.push(buildPreviewHref(selectedProductKey))}
            >
              前往预览台
            </Button>
          </div>
        </header>

        <div className="page-main-scroll">
          <div className="page-main-grid">
            <div className="page-main-stack">
              <Card className="prototype-card" title="上传新版本" loading={loading}>
                <Form form={uploadForm} layout="vertical">
                  <div className="upload-grid">
                    <Form.Item className="upload-field" label="产品" required>
                      <Select
                        value={selectedProductKey}
                        onChange={handleProductChange}
                        options={products.map((item) => ({ label: `${item.name} (${item.key})`, value: item.key }))}
                      />
                    </Form.Item>
                    <Form.Item name="version" className="upload-field" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                      <Input placeholder="例如 v1.0.0" />
                    </Form.Item>
                    <Form.Item name="title" className="upload-field" label="版本标题">
                      <Input placeholder="可选" />
                    </Form.Item>
                    <Form.Item name="remark" className="upload-field-full" label="更新说明">
                      <Input.TextArea rows={3} placeholder="可选" />
                    </Form.Item>
                    <Form.Item className="upload-field-full" label="源码压缩包">
                      <Upload.Dragger
                        className="admin-upload-dragger"
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
                          <InboxOutlined style={{ color: '#2563eb' }} />
                        </p>
                        <p>拖拽或点击上传源码 zip</p>
                        <p className="ant-upload-hint">压缩包内需包含 package.json 和 build 脚本，构建产物固定输出到 dist/</p>
                      </Upload.Dragger>
                    </Form.Item>
                  </div>
                </Form>

                {uploading ? <Progress className="task-progress" percent={uploadProgress} status="active" style={{ marginBottom: 16 }} /> : null}
                {uploadError ? (
                  <Alert type="error" showIcon style={{ marginBottom: 16 }} message="上传失败" description={uploadError} />
                ) : null}

                <Button className="hero-button" type="primary" onClick={() => void uploadVersion()} loading={uploading}>
                  上传并创建任务
                </Button>
              </Card>

              <Card className="prototype-card" title="当前任务" loading={loading}>
                {activeJob ? (
                  <>
                    <div className="terminal-card-header">
                      <div className="terminal-card-title">
                        <Text strong>当前任务:</Text>
                        <span className="terminal-job-name">
                          {activeJob.version} / {activeJob.fileName}
                        </span>
                        {renderStatusTag(activeJob.status)}
                      </div>
                      <Text type="secondary">{activeJob.progressPercent}%</Text>
                    </div>

                    <Progress
                      className="task-progress"
                      percent={activeJob.progressPercent}
                      status={activeJob.status === 'failed' ? 'exception' : activeJob.status === 'success' ? 'success' : 'active'}
                      style={{ marginBottom: 18 }}
                    />

                    <Alert
                      type={activeJob.status === 'failed' ? 'error' : activeJob.status === 'success' ? 'success' : 'info'}
                      showIcon
                      style={{ marginBottom: 18 }}
                      message={activeJob.logSummary || '任务执行中'}
                      description={activeJob.errorMessage || `当前步骤：${activeJob.currentStep ?? 'waiting'}`}
                    />

                    <div className="task-layout">
                      <div className="task-steps">
                        <BuildJobStepList
                          steps={activeJob.steps}
                          selectedStepKey={selectedLogStepKey}
                          onSelect={(stepKey) => {
                            setSelectedLogStepKey(stepKey);
                            setIsLogStepPinned(true);
                          }}
                        />
                      </div>

                      <div className="task-terminal-shell">
                        <div className="task-terminal-chrome">
                          <div className="task-terminal-lights">
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="task-terminal-badge">
                            {activeJobLog?.step ?? selectedLogStepKey ?? activeJob.currentStep ?? 'status'}
                          </div>
                        </div>
                        <BuildJobTerminal content={terminalContent} emptyText={terminalEmptyText} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <Empty description="当前没有正在跟踪的任务" />
                  </div>
                )}
              </Card>

              <Card
                className="prototype-card prototype-card-tight"
                title="版本列表"
                extra={
                  <Input.Search
                    allowClear
                    className="version-search"
                    prefix={<SearchOutlined />}
                    placeholder="搜索版本号或标题"
                    style={{ width: 280 }}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                }
                loading={loading}
              >
                <Table<ProductVersionItem>
                  className="prototype-table"
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
                    { title: '状态', key: 'status', width: 190, render: (_, item) => <StatusTags version={item} /> },
                    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
                    {
                      title: '操作',
                      key: 'actions',
                      width: 320,
                      render: (_, item) => (
                        <Space wrap>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            disabled={!item.entryUrl || item.status !== 'published'}
                            onClick={() => {
                              if (productDetail) {
                                router.push(buildPreviewHref(productDetail.key, item.version));
                              }
                            }}
                          >
                            预览
                          </Button>
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
            </div>

            <div className="page-main-stack">
              <Card className="prototype-card prototype-card-tight" title="最近任务" loading={loading}>
                <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
                  <List
                    locale={{ emptyText: '暂无任务记录' }}
                    dataSource={jobs}
                    renderItem={(item) => (
                      <List.Item style={{ border: 'none', padding: 0 }}>
                        <div
                          className={`job-list-item${item.id === activeJob?.id ? ' is-active' : ''}`}
                          style={{ width: '100%', cursor: 'pointer' }}
                          onClick={() => {
                            setActiveJobId(item.id);
                            setActiveJob(item);
                          }}
                        >
                          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Space wrap>
                              <Text strong style={{ fontFamily: "'SFMono-Regular', Consolas, monospace" }}>
                                {item.version}
                              </Text>
                              {renderStatusTag(item.status)}
                            </Space>
                            <Text type="secondary">{item.progressPercent}%</Text>
                          </Space>
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13, color: '#334155' }}>{item.fileName}</div>
                            <Text type="secondary">{item.errorMessage || item.logSummary || '等待执行'}</Text>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Card>

              <Card
                className="prototype-card"
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: '#94a3b8' }} />
                    <span>当前产品信息</span>
                  </Space>
                }
                loading={loading}
              >
                {productDetail ? (
                  <div className="product-info-grid">
                    <div>
                      <div className="product-info-item-label">产品名称</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{productDetail.name}</div>
                    </div>
                    <div>
                      <div className="product-info-item-label">产品 Key</div>
                      <div className="product-key-pill">{productDetail.key}</div>
                    </div>
                    <div>
                      <div className="product-info-item-label">描述</div>
                      <Paragraph className="muted" style={{ marginBottom: 0 }}>
                        {productDetail.description || '暂无描述'}
                      </Paragraph>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">请选择产品</div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}
