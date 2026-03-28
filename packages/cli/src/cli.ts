import { Command } from 'commander';
import { VERSION } from '@sunco/core';

const program = new Command();

program
  .name('sunco')
  .version(VERSION)
  .description('Agent Workspace OS');

program.parse();
