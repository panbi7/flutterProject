import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Failsafe path resolution for CJS/ESM and Netlify
let _dirname = ''
try {
  _dirname = path.dirname(fileURLToPath(import.meta.url))
} catch (e) {
  _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd()
}
if (!_dirname) _dirname = process.cwd()

export const PORT = process.env.PORT || 3000
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
export const GEMINI_MODEL = 'gemini-flash-latest'

export const ALLOWED_INTENTS = [
  'auth_basic',
  'auth_social',
  'auth_quick_start',
  'auth_korea',
  'auth_secure',
  'auth_custom',
  'map',
  'state_management',
  'network_http',
  'routing',
  'local_db',
  'media',
  'firebase',
  'storage',
  'ui_design',
  'forms',
  'device',
  'native',
  'utils',
  'rendering',
]

export const ALLOWED_TYPES = [
  'feature_request',
  'followup_question',
  'smalltalk',
  'clarify',
  'package_query',
]

// Netlify Functions environment detection
const isNetlify = !!process.env.LAMBDA_TASK_ROOT
const baseDir = isNetlify ? process.env.LAMBDA_TASK_ROOT : _dirname

export const DATA_DIR = isNetlify
  ? path.join(baseDir, 'src', 'netlify', 'functions', 'data') // Netlify bundles files under src or at root
  : path.join(_dirname, '..', 'data')

// If the specific netlify path doesn't work, we'll also try a flatter approach in data.js
export const INTENTS_DIR = path.join(DATA_DIR, 'intents')
export const PACKAGES_DIR = path.join(DATA_DIR, 'packages')
