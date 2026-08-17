export const MCP_TOOLS = [
  {
    name: 'install_1m',
    description: "Install or repair codex-1M when the user types '1m install'. Adds the MaxForAI/codex-1M marketplace and installs the plugin, whose manifest provides the MCP server and command Skill. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'update_1m',
    description: "Update codex-1M when the user types '1m update'. Refreshes the codex-1m marketplace with 'codex plugin marketplace upgrade codex-1m --json', then removes and re-adds the plugin at the refreshed version. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'doctor_1m',
    description: "Diagnose codex-1M when the user types '1m doctor'. Reports Codex CLI, marketplace repository, installed plugin, configuration mode, MCP server, profile file, and state file status. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'uninstall_1m',
    description: "Fully uninstall codex-1M when the user types '1m uninstall'. Removes managed configuration, legacy prompt copies, plugin, and marketplace. Matching is case-insensitive; reinstall afterward requires the terminal bootstrap command.",
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
