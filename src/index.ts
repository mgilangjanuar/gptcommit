#!/usr/bin/env node

import { Command } from 'commander'
import { commit } from './actions/commit.js'
import { setToken } from './actions/setToken.js'

const program = new Command()

program
  .name('gptcommit')
  .description('A CLI tool to help you commit your changes')
  .version('0.1.2')

program
  .command('set-token <token>')
  .description('Set your OpenAI token (https://platform.openai.com/account/api-keys)')
  .action(setToken)

program
  .option('-f, --files <files...>', 'Select a file or directory to commit', '.')
  .description('Commit your changes')
  .action(commit)

program.parse()