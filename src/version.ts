// package.json is the single source of truth. The build bundles this value into
// mcp/server.cjs and keeps the CLI runtime tied to the published package.
export const PACKAGE_VERSION: string = require('../package.json').version;
