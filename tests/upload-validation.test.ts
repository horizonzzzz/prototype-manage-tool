import { describe, expect, test } from 'vitest';

import {
  detectForbiddenAbsoluteReferences,
  extractUploadFileFromEvent,
  normalizeUploadFileName,
} from '@/lib/domain/upload-validation';

describe('upload validation helpers', () => {
  test('normalizes zip file names', () => {
    expect(normalizeUploadFileName('demo.ZIP')).toBe('demo.ZIP');
    expect(() => normalizeUploadFileName('../demo.zip')).toThrow('Only zip files are allowed');
    expect(() => normalizeUploadFileName('demo.txt')).toThrow('Only zip files are allowed');
  });

  test('rejects root absolute asset references', () => {
    const html = `
      <html>
        <head>
          <script src="/assets/index.js"></script>
        </head>
      </html>
    `;

    expect(detectForbiddenAbsoluteReferences(html)).toContain('/assets/index.js');
  });

  test('allows relative asset references', () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="./assets/index.css" />
        </head>
      </html>
    `;

    expect(detectForbiddenAbsoluteReferences(html)).toHaveLength(0);
  });

  test('extracts uploaded file from antd upload event', () => {
    const targetFile = { name: 'demo.zip' };
    const event = {
      file: {
        originFileObj: targetFile,
      },
      fileList: [
        {
          originFileObj: targetFile,
        },
      ],
    };

    expect(extractUploadFileFromEvent(event)).toBe(targetFile);
  });

  test('falls back to the latest file in upload fileList', () => {
    const targetFile = { name: 'demo.zip' };
    const event = {
      fileList: [
        { originFileObj: { name: 'older.zip' } },
        { originFileObj: targetFile },
      ],
    };

    expect(extractUploadFileFromEvent(event)).toBe(targetFile);
  });
});
