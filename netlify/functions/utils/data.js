import fs from 'node:fs/promises'
import path from 'node:path'
import { INTENTS_DIR, PACKAGES_DIR } from './constants.js'

export async function loadJSON(filePath) {
  const data = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(data)
}

export async function getScenarios() {
  const entries = await loadDirectoryJSON(INTENTS_DIR)
  if (entries.length === 0) {
    // Hardcoded minimal fallback for Netlify bundle issues
    return {
      'auth_basic': { packages: ['firebase_auth', 'google_sign_in'] },
      'map': { packages: ['google_maps_flutter'] }
    }
  }
  const scenarios = {}
  for (const { key, data } of entries) {
    scenarios[key] = data
  }
  return scenarios
}

export async function getPackages() {
  const entries = await loadDirectoryJSON(PACKAGES_DIR)
  if (entries.length === 0) {
    // Hardcoded minimal fallback
    return [
      { id: 'firebase_auth', name: 'Firebase Auth', description: 'Firebase Authentication for Flutter' },
      { id: 'google_sign_in', name: 'Google Sign In', description: 'Google Sign In for Flutter' },
      { id: 'google_maps_flutter', name: 'Google Maps Flutter', description: 'Google Maps for Flutter' }
    ]
  }
  const list = []
  for (const { data } of entries) {
    if (Array.isArray(data)) {
      list.push(...data)
    }
  }
  return list
}

export async function getPackagesByIntent(intent) {
  const scenarios = await getScenarios()
  const packagesAll = await getPackages()
  const scenario = scenarios[intent]
  if (!scenario) return []

  const byId = new Map(packagesAll.map((p) => [p.id, p]))
  const result = []
  for (const id of scenario.packages || []) {
    if (byId.has(id)) {
      result.push(byId.get(id))
    } else {
      result.push({ id, name: id })
    }
  }
  return result
}

async function loadDirectoryJSON(dirPath) {
  const potentialPaths = [
    dirPath,
    path.join(process.cwd(), 'netlify/functions/data', path.basename(dirPath)),
    path.join(process.cwd(), '.netlify/functions-internal', path.basename(dirPath)),
    path.join(__dirname, '..', 'data', path.basename(dirPath))
  ]

  let validPath = null
  for (const p of potentialPaths) {
    try {
      await fs.access(p)
      validPath = p
      break
    } catch (_) { }
  }

  if (!validPath) {
    console.warn(`[DATA] No valid path found for ${path.basename(dirPath)}`)
    return []
  }

  let files = []
  try {
    files = await fs.readdir(validPath)
  } catch (err) {
    console.error(`[DATA] Error reading directory ${validPath}:`, err)
    return []
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()
  const entries = []
  for (const file of jsonFiles) {
    const fullPath = path.join(validPath, file)
    const key = path.basename(file, '.json')
    const data = await loadJSON(fullPath)
    entries.push({ key, data })
  }
  return entries
}
