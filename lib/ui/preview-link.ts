type ClipboardLike = {
  writeText(text: string): Promise<void>;
};

type NavigatorLike = {
  clipboard?: ClipboardLike;
};

type TextAreaLike = {
  value: string;
  style: Record<string, string>;
  setAttribute?: (name: string, value: string) => void;
  select: () => void;
  setSelectionRange?: (start: number, end: number) => void;
};

type DocumentLike = {
  createElement: (tagName: 'textarea') => TextAreaLike;
  body?: {
    appendChild: (node: TextAreaLike) => void;
    removeChild: (node: TextAreaLike) => void;
  };
  execCommand?: (command: 'copy') => boolean;
};

type CopyTextRuntime = {
  navigator?: NavigatorLike;
  document?: DocumentLike;
};

function legacyCopyText(text: string, documentRef?: DocumentLike) {
  if (!documentRef?.body || typeof documentRef.createElement !== 'function' || typeof documentRef.execCommand !== 'function') {
    return false;
  }

  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute?.('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';

  documentRef.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange?.(0, textarea.value.length);
    return documentRef.execCommand('copy');
  } finally {
    documentRef.body.removeChild(textarea);
  }
}

export function resolvePreviewEntryUrl(entryUrl: string, origin: string) {
  return new URL(entryUrl, origin).toString();
}

export async function copyText(text: string, runtime: CopyTextRuntime = {}) {
  const navigatorRef = runtime.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);

  try {
    if (navigatorRef?.clipboard?.writeText) {
      await navigatorRef.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy copy path for insecure or restricted contexts.
  }

  const documentRef =
    runtime.document ?? (typeof document !== 'undefined' ? (document as unknown as DocumentLike) : undefined);
  return legacyCopyText(text, documentRef);
}
