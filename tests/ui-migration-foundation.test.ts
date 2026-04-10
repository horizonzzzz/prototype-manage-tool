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
const previewProductListSource = readFileSync(new URL('../components/preview/preview-product-list.tsx', import.meta.url), 'utf8');
const adminProductListSource = readFileSync(new URL('../components/admin/admin-product-list.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const buttonSource = readFileSync(new URL('../components/ui/button.tsx', import.meta.url), 'utf8');
const selectSource = readFileSync(new URL('../components/ui/select.tsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../components/ui/card.tsx', import.meta.url), 'utf8');
const dialogSource = readFileSync(new URL('../components/ui/dialog.tsx', import.meta.url), 'utf8');
const badgeSource = readFileSync(new URL('../components/ui/badge.tsx', import.meta.url), 'utf8');

describe('UI migration foundation', () => {
  test('removes Ant Design providers from the app shell and page entrypoints', () => {
    expect(layoutSource).not.toMatch(/AntdRegistry|@ant-design\/nextjs-registry/);
    expect(adminPageSource).not.toMatch(/App as AntApp|from 'antd'/);
    expect(previewPageSource).not.toMatch(/App as AntApp|from 'antd'/);
  });

  test('replaces feature-level Ant Design imports with local project UI layers', () => {
    expect(adminDashboardSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(previewProductListSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(adminProductListSource).not.toMatch(/from 'antd'|@ant-design\/icons/);
    expect(adminDashboardSource).not.toContain('<StandardTablePage');
    expect(adminDashboardSource).toContain('<UploadVersionDialog');
    expect(adminDashboardSource).toContain('<BuildHistoryDrawer');
    expect(previewPageSource).toContain('<PreviewProductList');
    expect(adminProductListSource).toContain('<Table');
  });

  test('keeps legacy Ant Design packages out of the dependency graph', () => {
    expect(packageJson.dependencies).not.toHaveProperty('antd');
    expect(packageJson.dependencies).not.toHaveProperty('@ant-design/icons');
    expect(packageJson.dependencies).not.toHaveProperty('@ant-design/nextjs-registry');
  });

  test('removes global style selectors that depend on Ant Design DOM internals', () => {
    expect(globalStyles).not.toMatch(/\.ant-[a-z0-9-]+/);
  });

  test('uses prototype-aligned radius tokens and adds pointer feedback for native buttons', () => {
    expect(globalStyles).toContain('--radius: 0.625rem;');
    expect(globalStyles).toContain('button:not(:disabled)');
    expect(globalStyles).toContain('cursor: pointer;');
  });

  test('keeps shared primitives aligned with prototype slot and sizing capabilities', () => {
    expect(buttonSource).toContain('group/button');
    expect(buttonSource).toContain('xs:');
    expect(buttonSource).toMatch(/icon-sm/);
    expect(selectSource).toContain("size = 'default'");
    expect(selectSource).toContain('data-size={size}');
    expect(selectSource).toContain('function SelectGroup');
    expect(cardSource).toContain("size = 'default'");
    expect(cardSource).toContain('data-size={size}');
    expect(cardSource).toContain('function CardAction');
    expect(dialogSource).toContain('showCloseButton');
    expect(dialogSource).toContain('size="icon-sm"');
    expect(badgeSource).toContain('group/badge');
    expect(badgeSource).toContain('h-5');
    expect(badgeSource).toContain('ghost');
  });
});
