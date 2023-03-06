import Configstore from 'configstore'

export const config = new Configstore('committer', {
  style: 'long',
  description: 'bullet',
  prefix: true
})