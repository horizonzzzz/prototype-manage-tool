import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const packageJson = JSON.parse(readProjectSource('package.json')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const layoutSource = readProjectSource('app/layout.tsx');
const adminPageSource = readProjectSource('app/[locale]/(workspace)/admin/page.tsx');
const previewPageSource = readProjectSource('app/[locale]/(preview)/preview/page.tsx');
const adminDashboardSource = readProjectSource('components/admin-dashboard.tsx');
const previewProductListSource = readProjectSource('components/preview/preview-product-list.tsx');
const adminProductListSource = readProjectSource('components/admin/panels/admin-product-list.tsx');
const globalStyles = readProjectSource('app/globals.css');
const buttonSource = readProjectSource('components/ui/button.tsx');
const selectSource = readProjectSource('components/ui/select.tsx');
const cardSource = readProjectSource('components/ui/card.tsx');
const dialogSource = readProjectSource('components/ui/dialog.tsx');
const badgeSource = readProjectSource('components/ui/badge.tsx');

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
