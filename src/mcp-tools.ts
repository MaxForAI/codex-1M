export const MCP_TOOLS = [
  {
    name: 'toggle_1m_context',
    description: 'Use this when the user enters "1M on" or "1M off" (case-insensitive). Call with enable=true for 1M on and enable=false for 1M off.',
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
    description: 'Use this when the user enters "1M state" (case-insensitive). Returns the current Codex context configuration without modifying it.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
