import { FeaturePlaceholder } from '@/components/placeholders/feature-placeholder';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">设置</h2>
        <p className="text-muted-foreground">配置语言和系统偏好。</p>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div>
            <h3 className="text-lg font-medium">语言</h3>
            <p className="text-sm text-muted-foreground">切换工作台演示语言。</p>
          </div>
          <LanguageSwitcher />
        </div>
        <FeaturePlaceholder
          title="更多设置即将接入"
          description="通知、偏好和访问策略将在此提供。"
          tagLabel="预留功能"
          demoActionLabel="演示入口"
        />
      </div>
    </div>
  );
}
