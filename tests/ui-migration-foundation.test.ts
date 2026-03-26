import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const adminPageSource = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
const previewPageSource = readFileSync(new URL('../app/preview/page.tsx', import.meta.url), 'utf8');
const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const previewBrowserSource = readFileSync(new URL('../components/preview-browser.tsx', import.meta.url), 'utf8');
const adminProductListItemSource = readFileSync(new URL('../components/admin-product-list-item.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('UI migration foundation', () => {
  test('removes Ant Design providers from the app shell and page entrypoints', () => {
    expect(layoutSource).not.toMatch(/AntdRegistry|@ant-design\/nextjs-registry/);
    expect(adminPageSource).not.toMatch(/App as AntApp|from 'antd'/);
    expect(previewPageSource).not.toMatch(/App as AntApp|from 'antd'/);
  });

  test('replaces feature-level Ant Design imports with local project UI layers', () => {
    expect(adminDashboardSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(previewBrowserSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(adminProductListItemSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(adminDashboardSource).toContain('<PanelCard');
    expect(previewBrowserSource).toContain('<VersionPillBar');
    expect(previewBrowserSource).toContain('<StatusChip');
  });

  test('swaps package dependencies to the Tailwind v4 and shadcn-style stack', () => {
    expect(packageJson.dependencies).not.toHaveProperty('antd');
    expect(packageJson.dependencies).not.toHaveProperty('@ant-design/icons');
    expect(packageJson.dependencies).not.toHaveProperty('@ant-design/nextjs-registry');
    expect(packageJson.dependencies).toHaveProperty('lucide-react');
    expect(packageJson.dependencies).toHaveProperty('sonner');
    expect(packageJson.dependencies).toHaveProperty('react-hook-form');
    expect(packageJson.dependencies).toHaveProperty('@hookform/resolvers');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-dialog');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-dropdown-menu');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-select');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-alert-dialog');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-progress');
    expect(packageJson.dependencies).toHaveProperty('@radix-ui/react-slot');
    expect(packageJson.dependencies).toHaveProperty('class-variance-authority');
    expect(packageJson.dependencies).toHaveProperty('clsx');
    expect(packageJson.dependencies).toHaveProperty('tailwind-merge');
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
    expect(packageJson.devDependencies).toHaveProperty('@tailwindcss/postcss');
  });

  test('removes global style selectors that depend on Ant Design DOM internals', () => {
    expect(globalStyles).not.toMatch(/\.ant-[a-z0-9-]+/);
  });

  test('uses tighter global radius tokens and adds pointer feedback for native buttons', () => {
    expect(globalStyles).toContain('--radius: 0.875rem;');
    expect(globalStyles).toContain('button:not(:disabled)');
    expect(globalStyles).toContain('cursor: pointer;');
  });
});
