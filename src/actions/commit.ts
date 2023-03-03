import { execSync } from 'child_process'
import ora from 'ora'
import inquirer from 'inquirer'
import { r } from '../utils/OpenAI.js'
import { config } from '../utils/Storage.js'

export async function commit({ file = '.' }: { file: string }) {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `committer set-token <your token>`.').fail()
    return
  }

  execSync(`git add ${file}`).toString()
  const diffString = execSync(`git add ${file} && git diff --staged`).toString()

  const request = async () => {
    try {
      const { data } = await r.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `Create a descriptive commit message with explanations of changes in the bullet form:\n\n${diffString}\n\nCommit:`
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

  while (!isDone) {
    const spinner = ora('Generating a commit message...').start()
    try {
      commitMessage = await request()
      spinner.succeed('Successfully generated a commit message.')
      console.log(`---\n${commitMessage}\n---`)
    } catch (error) {
      spinner.fail(error.message)
      return
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to commit with this message?'
      }
    ])
    if (confirm) {
      isDone = true
    }
  }

  execSync(`printf "${commitMessage}" | git commit -F-`)
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
      spinner.fail(error.message)
      return
    }
  }
}