export const MCP_TOOLS = [
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
