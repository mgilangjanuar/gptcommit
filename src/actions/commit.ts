import { execSync } from 'child_process'
import inquirer from 'inquirer'
import ora from 'ora'
import { r } from '../utils/OpenAI.js'
import { config } from '../utils/Storage.js'

export async function commit({ files = ['.'] }: { files: string[] }) {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `gptcommit set-token <your token>`.').fail()
    return
  }

  const request = async (compact: boolean = false) => {
    const diffString = execSync(compact ? `git status ${files.join(' ')}` : `git add ${files.join(' ')} && git diff --staged`).toString()
    try {
      const { data } = await r.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        temperature: 0.05,
        messages: [
          {
            role: 'user',
            content: `Create a${
              config.get('style') === 'long' ? ` title and change details in the ${
                config.get('description') ? 'bullet' : 'descriptive'} form` : ' title'
            } for the commit message${
              config.get('prefix') ? ' using prefix "feat/enhancement/fix/refactor/style/docs/test/chore:"'
                : ' without prefix "feat/enhancement/fix/refactor/style/docs/test/chore:"'
            } with explanations of new changes only:\n\n${diffString}\n\nCommit:`
          }
        ]
      })
      return data.choices[0].message.content.trim()
    } catch (error) {
      throw error.response.data.error || error.response.data || error
    }
  }

  let commitMessage: string
  let isDone: boolean = false

  const spinner = ora()
  while (!isDone) {
    console.clear()
    spinner.start('Generating a commit message...')
    try {
      commitMessage = await request()
    } catch (error) {
      try {
        commitMessage = await request(true)
      } catch (error) {
        execSync('git reset')
        spinner.fail(error.message)
        return
      }
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
      execSync('git reset')
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