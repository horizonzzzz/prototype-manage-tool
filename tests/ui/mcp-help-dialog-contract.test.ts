import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const mcpPageSource = readProjectSource('app/[locale]/(workspace)/mcp/page.tsx');
const mcpSettingsSource = readProjectSource('components/settings/mcp-keys-settings.tsx');

describe('mcp help dialog contract', () => {
  test('passes a dynamic mcp endpoint url from the server page into the settings component', () => {
    expect(mcpPageSource).toContain("from 'next/headers'");
    expect(mcpPageSource).toContain('resolveRequestOrigin');
    expect(mcpPageSource).toContain('buildMcpEndpointUrl');
    expect(mcpPageSource).toContain('mcpEndpointUrl={');
  });

  test('renders a dedicated help action alongside mcp key creation', () => {
    expect(mcpSettingsSource).toContain("helpDialogOpen");
    expect(mcpSettingsSource).toContain("t('helpOpen')");
    expect(mcpSettingsSource).toContain('CircleHelp');
  });

  test('renders markdown-based setup instructions inside the help dialog', () => {
    expect(mcpSettingsSource).toContain("from 'react-markdown'");
    expect(mcpSettingsSource).toContain('buildHelpMarkdown');
    expect(mcpSettingsSource).toContain('mcpEndpointUrl');
  });

  test('adds a copy action to fenced code blocks in the help dialog', () => {
    expect(mcpSettingsSource).toContain('copyHelpCode');
    expect(mcpSettingsSource).toContain("from '@/lib/ui/preview-link'");
    expect(mcpSettingsSource).toContain("t('helpCopyCode')");
    expect(mcpSettingsSource).toContain('absolute right-2 top-2');
  });

  test('renders single-line code blocks with an inline copy action while keeping multi-line blocks top-right', () => {
    expect(mcpSettingsSource).toContain("const isSingleLineCodeBlock = !codeBlock.value.includes('\\n')");
    expect(mcpSettingsSource).toContain('mt-3 flex items-center gap-2 rounded-md bg-background p-3 text-xs leading-6');
    expect(mcpSettingsSource).toContain('block w-max whitespace-pre');
    expect(mcpSettingsSource).toContain('overflow-x-auto rounded-md bg-background p-3 pr-12 pt-10 text-xs leading-6');
  });

  test('keeps the help dialog shell fixed while the markdown body scrolls', () => {
    expect(mcpSettingsSource).toContain('flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden');
    expect(mcpSettingsSource).toContain('min-h-0 flex-1 overflow-y-auto');
  });

  test('renders the authorization header example outside translated message strings', () => {
    expect(mcpSettingsSource).toContain('MCP_AUTHORIZATION_HEADER');
    expect(mcpSettingsSource).toContain('${MCP_AUTHORIZATION_HEADER}');
  });
});
