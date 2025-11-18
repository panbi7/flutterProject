export async function postIntent(message) {
  // Use relative URL - works on both localhost and Netlify
  const apiUrl = '/api/intent'

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    // For demo consistency, still parse if possible
    try { return await res.json() } catch (_) { return { intent: 'auth_basic', source: 'fallback', packages: [] } }
  }
  return res.json()
}

