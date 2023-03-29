import ora from 'ora'
import { r } from '../utils/OpenAI.mjs'
import { config } from '../utils/Storage.mjs'

export async function setModel(model: string) {
  if (!config.get('token')) {
    ora('You need to set your OpenAI token first. Run `gptcommit set-token <your token>`.').fail()
    return
  }

  const spinner = ora('Checking model...').start()
  try {
    await r.get(`/models/${model}`)
    config.set('model', model)
    spinner.succeed('Model set')
  } catch (error) {
    spinner.fail('Model not found')
  }
}