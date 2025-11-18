import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Load .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const PORT = process.env.PORT || 3000
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

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
]

export const DATA_DIR = path.join(__dirname, '..', 'data')
export const INTENTS_DIR = path.join(DATA_DIR, 'intents')
export const PACKAGES_DIR = path.join(DATA_DIR, 'packages')
