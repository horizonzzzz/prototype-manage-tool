import { describe, expect, test, vi } from 'vitest';

type PreviewLinkModule = {
  resolvePreviewEntryUrl: (entryUrl: string, origin: string) => string;
  copyText: (text: string, runtime?: unknown) => Promise<boolean>;
};

async function loadPreviewLinkModule(): Promise<Partial<PreviewLinkModule>> {
  try {
    return (await import('@/lib/ui/preview-link')) as PreviewLinkModule;
  } catch {
    return {};
  }
}

type MockTextArea = {
  value: string;
  style: Record<string, string>;
  setAttribute: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

function createMockDocument(execCommandResult: boolean) {
  const textarea: MockTextArea = {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    select: vi.fn(),
  };
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  const execCommand = vi.fn(() => execCommandResult);

  return {
    textarea,
    document: {
      createElement: vi.fn(() => textarea),
      body: {
        appendChild,
        removeChild,
      },
      execCommand,
    },
  };
}

describe('preview link helpers', () => {
  test('resolves relative published entry url into an absolute html url', async () => {
    const previewLink = await loadPreviewLinkModule();

    expect(typeof previewLink.resolvePreviewEntryUrl).toBe('function');

    if (typeof previewLink.resolvePreviewEntryUrl !== 'function') {
      return;
    }

    expect(previewLink.resolvePreviewEntryUrl('/prototypes/crm/v1.2.0/index.html', 'http://localhost:3000')).toBe(
      'http://localhost:3000/prototypes/crm/v1.2.0/index.html',
    );
  });

  test('keeps absolute published entry url unchanged', async () => {
    const previewLink = await loadPreviewLinkModule();

    expect(typeof previewLink.resolvePreviewEntryUrl).toBe('function');

    if (typeof previewLink.resolvePreviewEntryUrl !== 'function') {
      return;
    }

    expect(previewLink.resolvePreviewEntryUrl('https://preview.example.com/crm/v1.2.0/index.html', 'http://localhost:3000')).toBe(
      'https://preview.example.com/crm/v1.2.0/index.html',
    );
  });

  test('copies through Clipboard API when available', async () => {
    const previewLink = await loadPreviewLinkModule();
    const writeText = vi.fn().mockResolvedValue(undefined);

    expect(typeof previewLink.copyText).toBe('function');

    if (typeof previewLink.copyText !== 'function') {
      return;
    }

    await expect(
      previewLink.copyText('http://localhost:3000/prototypes/crm/v1.2.0/index.html', {
        navigator: {
          clipboard: {
            writeText,
          },
        },
      }),
    ).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/prototypes/crm/v1.2.0/index.html');
  });

  test('falls back to execCommand copy when Clipboard API is unavailable or blocked', async () => {
    const previewLink = await loadPreviewLinkModule();
    const { textarea, document } = createMockDocument(true);

    expect(typeof previewLink.copyText).toBe('function');

    if (typeof previewLink.copyText !== 'function') {
      return;
    }

    await expect(
      previewLink.copyText('http://localhost:3000/prototypes/crm/v1.2.0/index.html', {
        navigator: {},
        document,
      }),
    ).resolves.toBe(true);

    expect(document.createElement).toHaveBeenCalledWith('textarea');
    expect(textarea.value).toBe('http://localhost:3000/prototypes/crm/v1.2.0/index.html');
    expect(textarea.select).toHaveBeenCalledTimes(1);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.body.appendChild).toHaveBeenCalledWith(textarea);
    expect(document.body.removeChild).toHaveBeenCalledWith(textarea);
  });
});
