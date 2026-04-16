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

  test('keeps the help dialog shell fixed while the markdown body scrolls', () => {
    expect(mcpSettingsSource).toContain('flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden');
    expect(mcpSettingsSource).toContain('min-h-0 flex-1 overflow-y-auto');
  });

  test('renders the authorization header example outside translated message strings', () => {
    expect(mcpSettingsSource).toContain('MCP_AUTHORIZATION_HEADER');
    expect(mcpSettingsSource).toContain('${MCP_AUTHORIZATION_HEADER}');
  });
});
