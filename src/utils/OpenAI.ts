import axios from 'axios'
import { config } from './Storage.js'

export const r = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${config.get('token')}`
  }
})