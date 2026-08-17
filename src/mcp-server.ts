#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config-manager';
import { ConfigModifier, formatConfigStatus } from './config-modifier';
import { doctorCodex1M, formatDoctorResult } from './doctor';
import { MCP_TOOLS } from './mcp-tools';
import {
  formatInstallResult,
  formatUpdateResult,
  formatUninstallResult,
  installCodex1M,
  updateCodex1M,
  uninstallCodex1M,
} from './integration';
import { PACKAGE_VERSION } from './version';

// Create server instance
const server = new Server(
  {
    name: 'codex-1m',
    version: PACKAGE_VERSION,
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
      case 'install_1m': {
        return {
          content: [{
            type: 'text',
            text: formatInstallResult(installCodex1M())
          }]
        };
      }

      case 'update_1m': {
        return {
          content: [{
            type: 'text',
            text: formatUpdateResult(updateCodex1M())
          }]
        };
      }

      case 'doctor_1m': {
        return {
          content: [{
            type: 'text',
            text: formatDoctorResult(doctorCodex1M())
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
