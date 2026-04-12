import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { BuildJobStepList } from '@/components/build-job-step-list';
import type { BuildJobStepItem } from '@/lib/types';

const steps: BuildJobStepItem[] = [
  {
    key: 'extract',
    label: '解压源码包',
    status: 'success',
    message: '这里曾经是日志摘要',
    startedAt: '2026-03-25T08:00:00.000Z',
    completedAt: '2026-03-25T08:00:01.000Z',
  },
  {
    key: 'install',
    label: '安装依赖',
    status: 'running',
    message: 'npm install 输出摘要',
    startedAt: '2026-03-25T08:00:01.000Z',
    completedAt: null,
  },
];

describe('BuildJobStepList', () => {
  test('renders step labels with data-status markers and no stale summary text', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BuildJobStepList, {
        steps,
        interactive: true,
        selectedStepKey: 'install',
        onSelect: () => undefined,
      }),
    );

    expect(markup).toContain('解压源码包');
    expect(markup).toContain('安装依赖');
    expect(markup).toContain('data-status="success"');
    expect(markup).toContain('data-status="running"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).not.toContain('这里曾经是日志摘要');
    expect(markup).not.toContain('npm install 输出摘要');
    expect(markup).not.toContain('task-step-item is-active is-selected');
  });

  test('renders steps as disabled buttons when interaction is locked', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BuildJobStepList, {
        steps,
        interactive: false,
        selectedStepKey: 'install',
        onSelect: () => undefined,
      }),
    );

    expect(markup).toContain('disabled=""');
  });
});
