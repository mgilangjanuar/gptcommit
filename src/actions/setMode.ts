import inquirer from 'inquirer'
import { config } from '../utils/Storage.js'

export async function setMode() {
  const { style } = await inquirer.prompt([
    {
      type: 'list',
      name: 'style',
      message: 'Select your commit style',
      choices: [
        `Long
eg. add 'comments' option

- add comments to the code
- add comments to the code`,
        `Short
eg. add 'comments' option`,
      ]
    }
  ])
  const styleAnswer = style.split('\n')[0].toLowerCase()
  config.set('style', styleAnswer)

  if (styleAnswer === 'long') {
    const { description } = await inquirer.prompt([
      {
        type: 'list',
        name: 'description',
        message: 'Select your commit description mode',
        choices: [
          `Bullet
eg.
- add comments to the code
- add comments to the code`,
          `Descriptive
eg. add comments to the code and add comments to the code.`,
        ]
      }
    ])
    config.set('description', description.split('\n')[0].toLowerCase())
  }

  const { prefix } = await inquirer.prompt([
    {
      type: 'list',
      name: 'prefix',
      message: 'Select your commit prefix mode',
      choices: [
        'Using "feat/enhancement/fix/refactor/style/docs/test/chore:"',
        'None',
      ]
    }
  ])
  config.set('prefix', prefix !== 'None')
}