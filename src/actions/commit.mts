import { AxiosError, isAxiosError } from 'axios'
import { execSync } from 'child_process'
import figlet from 'figlet'
import inquirer from 'inquirer'
import ora from 'ora'
import { r } from '../utils/OpenAI.mjs'
import { config } from '../utils/Storage.mjs'

export async function commit({ files = ['.'], context }: { files: string[], context?: string }, done: boolean = true, depth: number = 0): Promise<void> {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `gptcommit set-token <your token>`.').fail()
    return
  }

  const chunking = async (files: string[]) => {
    const messages = [
      {
        role: "system",
        content: "Response with array of folder or file name that determined the scope of changes from the git status. Please only answer with the parseable json array of string only!"
      },
      {
        role: "user",
        content: execSync(`git status ${files.join(' ')}`).toString()
      }
    ]
    const { data } = await r.post('/chat/completions', {
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages
    })
    return JSON.parse(data.choices[0].message.content) as string[]
  }

  const request = async (temperature: number = 0.01, msg: any[] = []) => {
    const diffString = execSync(`git add ${files.join(' ')} && git diff --staged`).toString()
    if (!diffString.trim()) {
      throw { status: 5001, message: 'No changes to commit' }
    }
    const messages = msg.length ? msg : [
      {
        role: 'system',
        content: `You are a commit message generator by creating exactly one commit message by the diff files without adding unnecessary information! Here is the format of good commit message from https://karma-runner.github.io/6.4/dev/git-commit-msg.html guides:

---
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
---

With allowed <type> values are feat, fix, perf, docs, style, refactor, test, and build. You can leave the <footer> section blank. And here's an example of a good commit message:

---
fix(middleware): ensure Range headers adhere more closely to RFC 2616

Add one new dependency, use \`range-parser\` (Express dependency) to compute range. It is more well-tested in the wild.

Fixes #2310
---${context ? `

With follow this instruction "${context}"!` : ''}`
      },
      {
        role: 'user',
        content: diffString
      }
    ]
    const { data } = await r.post('/chat/completions', {
      model: 'gpt-3.5-turbo',
      temperature,
      max_tokens: 100,
      messages
    })
    messages.push(data.choices[0].message)
    return messages
  }

  let messages: any[] = []
  let commitMessage: string
  let isDone: boolean = false
  const temperature: number = 0.01

  const spinner = ora()
  while (!isDone) {
    console.clear()
    console.log(
      `${figlet.textSync('gptcommit by\n@mgilangjanuar', { font: 'Contessa' })}\n`
    )
    console.log()
    spinner.start(`Generating a commit message for files: ${JSON.stringify(files)}...`)
    try {
      messages = await request(temperature, messages)
      commitMessage = messages.at(-1).content.replace(/^"|"$/g, '').trim()
      if (commitMessage.includes('---')) {
        commitMessage = commitMessage.split('---')[1].trim()
      }
    } catch (error) {
      if (isAxiosError(error)) {
        execSync('git reset')
        const err = error as AxiosError<{ error: { code: string } }>
        if (err.response.status === 400 && err.response.data.error.code === 'context_length_exceeded')  {
          spinner.fail('Changes too big. Please select a smaller set of files with `gptcommit --files <files...>`.')
          const { chunk } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'chunk',
              message: `Do you want to chunk the files ${JSON.stringify(files)}?`,
              default: true
            }
          ])
          if (chunk) {
            const spinner = ora(`Chunking the files ${JSON.stringify(files)}...`).start()
            const chunks = await chunking(files)
            spinner.stop()
            for (const [i, chunk] of chunks.entries()) {
              await commit({ files: [chunk], context }, i === chunks.length - 1, depth + 1)
            }
            isDone = true
          } else {
            return
          }
        }
      } else {
        spinner.fail(error.message)
        return
      }
    }

    if (commitMessage) {
      spinner.succeed(`Successfully generated a commit message for files: ${JSON.stringify(files)}\n---\n${commitMessage}\n---`)

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Generate a new commit message?',
          default: false
        }
      ])
      if (!confirm) {
        isDone = true
      } else {
        const { prompt } = await inquirer.prompt([
          {
            type: 'input',
            name: 'prompt',
            message: 'Any context or instruction you want to add?',
            default: ''
          }
        ])
        if (prompt) {
          messages.push({
            role: 'user',
            content: prompt
          })
        } else {
          messages.pop()
        }
        execSync('git reset')
        // temperature += 0.03
        console.log()
      }
    }
  }

  if (commitMessage) {
    const { edit } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'edit',
        message: 'Do you want to edit this commit message?',
        default: false
      }
    ])

    if (edit) {
      const { message } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'message',
          message: 'Edit your commit message',
          default: commitMessage
        }
      ])
      commitMessage = message
    }
    execSync(`printf "${commitMessage.replace(/\`/gi, '\\\`')}" | git commit -F-`)
  }

  if (done && !depth) {
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
}