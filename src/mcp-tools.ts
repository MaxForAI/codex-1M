export const MCP_TOOLS = [
  {
    name: 'install_1m',
    description: "Install or repair codex-1M when the user types '1m install'. Registers the MCP server, adds the MaxForAI/codex-1M marketplace, installs the plugin, and writes managed prompts. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'uninstall_1m',
    description: "Fully uninstall codex-1M when the user types '1m uninstall'. Removes managed configuration, prompts, plugin, marketplace, and this MCP registration. Matching is case-insensitive; reinstall afterward requires the terminal bootstrap command.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'toggle_1m_context',
    description: "Toggle Codex 1M-token context. Call with enable=true when the user types '1M on', enable=false when the user types '1M off'. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {
        enable: {
          type: 'boolean',
          description: 'True for 1M on; false for 1M off'
        },
        global: {
          type: 'boolean',
          description: 'True to modify top-level config; false to use the 1m profile (default: false)'
        }
      },
      required: ['enable']
    }
  },
  {
    name: 'context_status',
    description: "Report current Codex context configuration. Call when the user types '1M state'. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
