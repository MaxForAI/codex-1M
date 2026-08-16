#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'mcp', 'server.cjs');
const bundle = fs.readFileSync(bundlePath, 'utf8');
fs.writeFileSync(bundlePath, bundle.replace(/[\t ]+$/gm, ''), 'utf8');
