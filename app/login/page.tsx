import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  async function enterWorkspace() {
    'use server';
    redirect('/admin');
  }

  return (
    <AuthCard
      title="登录"
      description="输入演示账号信息后进入工作台。"
      footerText="还没有账号？"
      footerActionLabel="注册"
      footerActionHref="/register"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">邮箱</Label>
          <Input id="login-email" type="email" placeholder="m@example.com" autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">密码</Label>
          <Input id="login-password" type="password" autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full">
          登录
        </Button>
      </form>
    </AuthCard>
  );
}
