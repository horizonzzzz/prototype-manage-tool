import { FeaturePlaceholder } from '@/components/placeholders/feature-placeholder';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">系统设置</h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">用于补齐工作台导航链路的占位页面。</p>
      </div>

      <FeaturePlaceholder
        title="系统配置即将接入"
        description="这里将提供偏好项、通知配置和访问策略能力。"
        tagLabel="预留功能"
        demoActionLabel="演示入口"
      />
    </div>
  );
}
