import { FeaturePlaceholder } from '@/components/placeholders/feature-placeholder';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">用户管理</h2>
        <p className="text-muted-foreground">管理用户账户和权限。</p>
      </div>

      <FeaturePlaceholder
        title="即将推出"
        description="用户管理功能将在此提供。"
        tagLabel="预留功能"
        demoActionLabel="演示入口"
      />
    </div>
  );
}
