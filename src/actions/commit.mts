import { AxiosError, isAxiosError } from 'axios'
import { execSync } from 'child_process'
import inquirer from 'inquirer'
import ora from 'ora'
import { r } from '../utils/OpenAI.mjs'
import { config } from '../utils/Storage.mjs'

export async function commit({ files = ['.'], context }: { files: string[], context?: string }): Promise<void> {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `gptcommit set-token <your token>`.').fail()
    return
  }

  const request = async (temperature: number = 0.01) => {
    const diffString = execSync(`git add ${files.join(' ')} && git diff --staged -U0`).toString()
    if (!diffString.trim()) {
      throw { status: 5001, message: 'No changes to commit' }
    }
    const { data } = await r.post('/responses', {
      model: config.get('model') || 'gpt-4.1',
      temperature,
      input: `You are a commit message generator by creating exactly one commit message by the diff strings without adding unnecessary information! Here is the format of a good commit message from https://karma-runner.github.io/6.4/dev/git-commit-msg.html guides:

---
<type>(<scope>): <subject>
<BLANK LINE>
<body>
---

With allowed <type> values are feat, fix, perf, docs, style, refactor, test, and build. And here's an example of a good commit message:

---
fix(middleware): ensure Range headers adhere more closely to RFC 2616

Add one new dependency, use \`range-parser\` (Express dependency) to compute range. It is more well-tested in the wild.
---${context ? `

With follow this instruction "${context}"!` : ''}

## Diff

${diffString}`
    })
    return data.output[0].content[0].text
  }

  let commitMessage: string

  const spinner = ora()
  process.on('SIGINT', () => {
    execSync('git reset')
    process.exit()
  })

  console.clear()
  console.log('✨ Support us: https://github.com/sponsors/mgilangjanuar 💚\n')
  console.log('\u001b[2mPress Ctrl+C to exit\u001b[22m\n')
  spinner.start(`Generating a commit message for files: ${JSON.stringify(files)}...`)
  try {
    const result = await request()
    commitMessage = result.replace(/^"|"$/g, '').trim()
    if (commitMessage.includes('---')) {
      commitMessage = commitMessage.split('---')[1].trim()
    }
  } catch (error) {
    if (isAxiosError(error)) {
      execSync('git reset')
      const err = error as AxiosError<{ error: { code: string } }>
      if (err.response.status === 400 && err.response.data.error.code === 'context_length_exceeded')  {
        spinner.fail('Changes too big. Please select a smaller set of files with `gptcommit --files <files...>`.')
        return
      } else {
        if (error.response.data?.error?.message) {
          spinner.fail(error.response.data?.error?.message)
        } else {
          console.error(error.response.data)
        }
        return
      }
    } else {
      spinner.fail(error.message)
      return
    }
  }

  console.log(commitMessage)
  execSync(`printf "${commitMessage.replace(/\`/gi, '\\\`')}" | git commit -F-`)
  const branchStatus = execSync('git status').toString().trim()
  if (branchStatus.includes('branch is ahead')) {
    const { push } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'push',
        message: `${branchStatus.split('\n')[1]} Do you want to push the commit(s)?`,
      }
    ])
    if (push) {
      const spinner = ora('Pushing...').start()
      try {
        execSync('git pull origin $(git rev-parse --abbrev-ref HEAD)')
        execSync('git push -u origin HEAD')
        spinner.succeed('Pushed.')
      } catch (error) {
        execSync('git reset')
        spinner.fail(error.message)
        return
      }
    }
  }
}
