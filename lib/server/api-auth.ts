import { auth } from '@/auth';

export async function getApiUser() {
  return (await auth())?.user ?? null;
}
