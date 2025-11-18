export async function postIntent(message) {
  const res = await fetch('http://localhost:3000/api/intent', {
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

