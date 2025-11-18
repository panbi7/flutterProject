import fs from 'node:fs/promises'
import path from 'node:path'
import { INTENTS_DIR, PACKAGES_DIR } from './constants.js'

export async function loadJSON(filePath) {
  const data = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(data)
}

export async function getScenarios() {
  const entries = await loadDirectoryJSON(INTENTS_DIR)
  const scenarios = {}
  for (const { key, data } of entries) {
    scenarios[key] = data
  }
  return scenarios
}

export async function getPackages() {
  const entries = await loadDirectoryJSON(PACKAGES_DIR)
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
  let files = []
  try {
    files = await fs.readdir(dirPath)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()
  const entries = []
  for (const file of jsonFiles) {
    const fullPath = path.join(dirPath, file)
    const key = path.basename(file, '.json')
    const data = await loadJSON(fullPath)
    entries.push({ key, data })
  }
  return entries
}
