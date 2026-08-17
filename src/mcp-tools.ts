export const MCP_TOOLS = [
  {
    name: 'install_1m',
    description: "Install, repair, or upgrade codex-1M when the user types '1m install'. Saves the first pristine config, refreshes the marketplace, and installs the latest plugin. Repeating install performs an upgrade. Matching is case-insensitive.",
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
    description: "Configure or remove Codex 1M settings for new conversations. Call with enable=true when the user types '1M on', enable=false when the user types '1M off'. A successful write does not change the current conversation; matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {
        enable: {
          type: 'boolean',
          description: 'True for 1M on; false for 1M off'
        },
        global: {
          type: 'boolean',
          description: 'Deprecated compatibility input. Global mode is now the default.'
        },
        profile: {
          type: 'boolean',
          description: 'True to operate only on 1m.config.toml; false or omitted uses global config'
        }
      },
      required: ['enable']
    }
  },
  {
    name: 'context_status',
    description: "Report requested and expected usable Codex context configuration. Call when the user types '1M state'. Matching is case-insensitive.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
