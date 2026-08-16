#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config-manager';
import { ConfigModifier } from './config-modifier';
import { MCP_TOOLS } from './mcp-tools';

// Create server instance
const server = new Server(
  {
    name: 'codex-1m',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: MCP_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const configManager = new ConfigManager();
    const modifier = new ConfigModifier(configManager);

    switch (name) {
      case 'toggle_1m_context': {
        const enable = (args?.enable as boolean) || false;
        const global = (args?.global as boolean) || false;

        if (enable) {
          const result = modifier.enable1MContext(global);
          return {
            content: [{
              type: 'text',
              text: `${result}\n\nIMPORTANT: Start a new Codex session for changes to take effect.`
            }]
          };
        } else {
          const result = modifier.disable1MContext(global);
          return {
            content: [{
              type: 'text',
              text: `${result}\n\nIMPORTANT: Start a new Codex session for changes to take effect.`
            }]
          };
        }
      }

      case 'context_status': {
        const status = modifier.getStatus();
        return {
          content: [{
            type: 'text',
            text: `Current Codex Configuration:
- Model: ${status.model}
- Context Window: ${status.model_context_window.toLocaleString()} tokens
- Auto Compact Limit: ${status.model_auto_compact_token_limit.toLocaleString()} tokens
- 1M Enabled: ${status.enabled ? 'Yes (global)' : 'No'}
${!status.enabled ? '\nNote: 1M context is not currently enabled. Use toggle_1m_context to enable it.' : ''}`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('codex-1m MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
