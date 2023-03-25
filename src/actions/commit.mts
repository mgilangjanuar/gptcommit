import { execSync } from 'child_process'
import figlet from 'figlet'
import inquirer from 'inquirer'
import ora from 'ora'
import { r } from '../utils/OpenAI.mjs'
import { config } from '../utils/Storage.mjs'

export async function commit({ files = ['.'], context }: { files: string[], context?: string }) {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `gptcommit set-token <your token>`.').fail()
    return
  }

  const request = async (temperature: number = 0.09, msg: any[] = []) => {
    const diffString = execSync(`git add ${files.join(' ')} && git diff --staged`).toString()
    if (!diffString.trim()) {
      throw { status: 5001, message: 'No changes to commit' }
    }
    try {
      const messages = msg.length ? msg : [
        {
          role: 'system',
          content: `You are a helpful assistant that create exact one commit message with explanation details. Here is the format of good commit message:

<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>

With example:

\`\`\`
fix(middleware): ensure Range headers adhere more closely to RFC 2616

Add one new dependency, use \`range-parser\` (Express dependency) to compute range. It is more well-tested in the wild.

Fixes #2310
\`\`\`${context ? `\n\nWith follow this instruction "${context}".` : ''}`
        },
        {
          role: 'user',
          content: diffString
        }
      ]
      const { data } = await r.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        temperature,
        messages
      })
      messages.push(data.choices[0].message)
      return messages
      // return data.choices[0].message.content.replace(/^"|"$/g, '').trim()
    } catch (error) {
      throw error.response.data.error || error.response.data || error
    }
  }

  let messages: any[] = []
  let commitMessage: string
  let isDone: boolean = false
  const temperature: number = 0.09

  const spinner = ora()
  while (!isDone) {
    console.clear()
    console.log(
      `${figlet.textSync('gptcommit by\n@mgilangjanuar')}\n`
    )
    spinner.start('Generating a commit message...')
    try {
      messages = await request(temperature, messages)
      commitMessage = messages.at(-1).content.replace(/^"|"$/g, '').trim()
    } catch (error) {
      execSync('git reset')
      spinner.fail(error.message)
      return
    }
    spinner.succeed(`Successfully generated a commit message.\n---\n${commitMessage}\n---`)

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
      }
      execSync('git reset')
      // temperature += 0.05
      console.log()
    }
  }

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
  const { push } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'push',
      message: 'Do you want to push this?'
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