'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { getBuildJobTerminalWrite } from '@/lib/ui/build-job-log';

type TerminalModule = typeof import('@xterm/xterm');
type FitAddonModule = typeof import('@xterm/addon-fit');

type BuildJobTerminalProps = {
  content: string;
  emptyText: string;
  sessionKey: string;
  showEmptyTextWhenContentMissing?: boolean;
};

function resolveTerminalText(content: string, emptyText: string, showEmptyTextWhenContentMissing: boolean) {
  return content || (showEmptyTextWhenContentMissing ? emptyText : '');
}

export function BuildJobTerminal({
  content,
  emptyText,
  sessionKey,
  showEmptyTextWhenContentMissing = true,
}: BuildJobTerminalProps) {
  const t = useTranslations('buildHistory');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const renderedContentRef = useRef('');
  const renderedSessionKeyRef = useRef(sessionKey);

  useEffect(() => {
    if (!hostRef.current || terminalRef.current) {
      return;
    }

    let active = true;
    let removeResizeListener: (() => void) | null = null;

    void Promise.all([
      import('@xterm/xterm') as Promise<TerminalModule>,
      import('@xterm/addon-fit') as Promise<FitAddonModule>,
    ]).then(([xtermModule, fitAddonModule]) => {
      if (!active || !hostRef.current) {
        return;
      }

      const terminal = new xtermModule.Terminal({
        convertEol: true,
        cursorBlink: true,
        cursorStyle: 'bar',
        disableStdin: true,
        fontFamily: "'SFMono-Regular', 'Consolas', 'Liberation Mono', Menlo, monospace",
        fontSize: 12,
        lineHeight: 1.45,
        theme: {
          background: '#0f172a',
          foreground: '#dbe4ff',
          cursor: '#93c5fd',
          selectionBackground: 'rgba(147, 197, 253, 0.28)',
          black: '#0f172a',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e2e8f0',
          brightBlack: '#475569',
          brightRed: '#fca5a5',
          brightGreen: '#86efac',
          brightYellow: '#fcd34d',
          brightBlue: '#93c5fd',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#f8fafc',
        },
      });
      const fitAddon = new fitAddonModule.FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(hostRef.current);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      const initialContent = resolveTerminalText(content, emptyText, showEmptyTextWhenContentMissing);
      terminal.write(initialContent);
      renderedContentRef.current = initialContent;
      renderedSessionKeyRef.current = sessionKey;

      const handleResize = () => {
        fitAddonRef.current?.fit();
      };

      window.addEventListener('resize', handleResize);
      removeResizeListener = () => window.removeEventListener('resize', handleResize);
    });

    return () => {
      active = false;
      removeResizeListener?.();
      fitAddonRef.current?.dispose();
      terminalRef.current?.dispose();
      fitAddonRef.current = null;
      terminalRef.current = null;
      renderedContentRef.current = '';
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    const nextContent = resolveTerminalText(content, emptyText, showEmptyTextWhenContentMissing);
    const shouldForceReplace = renderedSessionKeyRef.current !== sessionKey;
    if (!shouldForceReplace && renderedContentRef.current === nextContent) {
      return;
    }

    const write = shouldForceReplace
      ? { mode: 'replace' as const, content: nextContent }
      : getBuildJobTerminalWrite(renderedContentRef.current, nextContent, emptyText);
    if (write.mode === 'append' && write.content) {
      terminal.write(write.content);
    } else {
      terminal.reset();
      terminal.write(write.content);
    }

    renderedContentRef.current = nextContent;
    renderedSessionKeyRef.current = sessionKey;
    fitAddonRef.current?.fit();
  }, [content, emptyText, sessionKey, showEmptyTextWhenContentMissing]);

  return <div ref={hostRef} className="build-job-terminal" aria-label={t('terminalAriaLabel')} />;
}
