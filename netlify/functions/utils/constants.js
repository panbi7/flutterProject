import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const PORT = process.env.PORT || 3000
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
export const GEMINI_MODEL = 'gemini-2.5-flash-lite'

export const ALLOWED_INTENTS = [
  'auth_basic',
  'auth_social',
  'auth_quick_start',
  'auth_korea',
  'auth_secure',
  'auth_custom',
  'map',
]

export const ALLOWED_TYPES = [
  'feature_request',
  'followup_question',
  'smalltalk',
  'clarify',
  'package_query',
]

export const DATA_DIR = path.join(__dirname, '..', 'data')
export const INTENTS_DIR = path.join(DATA_DIR, 'intents')
export const PACKAGES_DIR = path.join(DATA_DIR, 'packages')
