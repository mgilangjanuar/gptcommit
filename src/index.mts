#!/usr/bin/env node

import { execSync } from 'child_process'
import { Command } from 'commander'
import { commit } from './actions/commit.mjs'
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

// program
//   .command('set-mode')
//   .description('Select your commit style')
//   .action(setMode)

program
  .option('-f, --files <files...>', 'Select a file or directory to commit', ['.'])
  .option('-c, --context <context>', 'Add context to your commit message')
  .description('Commit your changes')
  .action(commit)

const reset = () => {
  console.log('\n\nResetting changes...')
  try {
    execSync('git reset')
  } catch (error) {
    console.error(error)
  }
}

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
  process.on(signal, reset)
})

process.stdin.on('data', (key) => {
  if (key.toString() === '\u0003') {
    reset()
  }
})

program.parse()