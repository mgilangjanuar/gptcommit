#!/usr/bin/env node

import { Command } from 'commander'
import { commit } from './actions/commit.mjs'
import { setMode } from './actions/setMode.mjs'
import { setToken } from './actions/setToken.mjs'

const program = new Command()

program
  .name('gptcommit')
  .description('A CLI tool to help you commit your changes')
  .version('0.1')

program
  .command('set-token <token>')
  .description('Set your OpenAI token (https://platform.openai.com/account/api-keys)')
  .action(setToken)

program
  .command('set-mode')
  .description('Select your commit style')
  .action(setMode)

program
  .option('-f, --files <files...>', 'Select a file or directory to commit', ['.'])
  .description('Commit your changes')
  .action(commit)

program.parse()