import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  async function enterWorkspace() {
    'use server';
    redirect('/admin');
  }

  return (
    <AuthCard
      title="注册"
      description="创建演示账号后进入工作台。"
      footerText="已有账号？"
      footerActionLabel="登录"
      footerActionHref="/login"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">邮箱</Label>
          <Input id="register-email" type="email" placeholder="m@example.com" autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">密码</Label>
          <Input id="register-password" type="password" autoComplete="new-password" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">确认密码</Label>
          <Input id="register-confirm-password" type="password" autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full">
          注册
        </Button>
      </form>
    </AuthCard>
  );
}
