#!/usr/bin/env node

import { startServer } from '../dist/server/standalone.js';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 3000;
const open = args.includes('--open');

startServer({ port, open });
