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
      title="登录演示账号"
      description="当前为占位认证流程，提交后会进入工作台。"
      footerText="还没有演示账号？"
      footerActionLabel="去注册"
      footerActionHref="/register"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">邮箱</Label>
          <Input id="login-email" type="email" placeholder="demo@example.com" autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">密码</Label>
          <Input id="login-password" type="password" placeholder="••••••••" autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full">
          进入工作台
        </Button>
      </form>
    </AuthCard>
  );
}
