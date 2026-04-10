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
      title="注册演示账号"
      description="当前为占位注册流程，提交后会进入工作台。"
      footerText="已有账号？"
      footerActionLabel="返回登录"
      footerActionHref="/login"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">邮箱</Label>
          <Input id="register-email" type="email" placeholder="demo@example.com" autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">密码</Label>
          <Input id="register-password" type="password" placeholder="••••••••" autoComplete="new-password" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">确认密码</Label>
          <Input id="register-confirm-password" type="password" placeholder="••••••••" autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full">
          创建并进入工作台
        </Button>
      </form>
    </AuthCard>
  );
}
