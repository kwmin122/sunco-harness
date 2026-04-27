#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadRuntimeCli() {
  const candidates = [
    path.join(__dirname, 'runtime-cli.js'),
    path.join(__dirname, '..', 'dist', 'runtime-cli.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  throw new Error([
    'SUNCO runtime CLI bundle not found.',
    `Checked: ${candidates.join(', ')}`,
    'Run `npm run build --workspace popcoru` before using the source-tree wrapper.',
  ].join(' '));
}

loadRuntimeCli()
  .then((mod) => mod.main(process.argv.slice(2)))
  .then((exitCode) => {
    process.exitCode = typeof exitCode === 'number' ? exitCode : 0;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
