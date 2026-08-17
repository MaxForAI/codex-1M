#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config-manager';
import { ConfigModifier, formatConfigStatus } from './config-modifier';
import { MCP_TOOLS } from './mcp-tools';
import {
  formatInstallResult,
  formatUninstallResult,
  installCodex1M,
  uninstallCodex1M,
} from './integration';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  install_1m:
    "Install or repair codex-1M when the user types '1m install'. Registers the MCP server, adds the MaxForAI/codex-1M marketplace, installs the plugin, and writes managed prompts. Matching is case-insensitive.",
  uninstall_1m:
    "Fully uninstall codex-1M when the user types '1m uninstall'. Removes managed configuration, prompts, plugin, marketplace, and this MCP registration. Matching is case-insensitive; reinstall afterward requires the terminal bootstrap command.",
  toggle_1m_context:
    "Toggle Codex 1M-token context. Call with enable=true when the user types '1M on', enable=false when the user types '1M off'. Matching is case-insensitive.",
  context_status:
    "Report current Codex context configuration. Call when the user types '1M state'. Matching is case-insensitive.",
};

const ADVERTISED_MCP_TOOLS = MCP_TOOLS.map((tool) => ({
  ...tool,
  description: TOOL_DESCRIPTIONS[tool.name] ?? tool.description,
}));

// Create server instance
const server = new Server(
  {
    name: 'codex-1m',
    version: '1.6.0',
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
    tools: ADVERTISED_MCP_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const configManager = new ConfigManager();
    const modifier = new ConfigModifier(configManager);

    switch (name) {
      case 'install_1m': {
        return {
          content: [{
            type: 'text',
            text: formatInstallResult(installCodex1M())
          }]
        };
      }

      case 'uninstall_1m': {
        return {
          content: [{
            type: 'text',
            text: formatUninstallResult(uninstallCodex1M())
          }]
        };
      }

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
            text: `Current Codex Configuration:\n${formatConfigStatus(status)}`
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
