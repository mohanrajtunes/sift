const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Something went wrong (${res.status})`)
  return data
}

export const addRepo = (url) => call('/repos/', { method: 'POST', body: JSON.stringify({ url }) })

// The browser remembers which repos you added, so "Your repos" works without an account.
export function rememberRepo(id) {
  try {
    const ids = JSON.parse(localStorage.getItem('sift:repos') || '[]')
    localStorage.setItem('sift:repos', JSON.stringify([id, ...ids.filter((i) => i !== id)].slice(0, 20)))
  } catch { /* private mode: fine, just not remembered */ }
}

export const getRepo = (id) => call(`/repos/${id}/`)
export const getGraph = (id) => call(`/repos/${id}/graph/`)
export const getFile = (id, path, start, end) =>
  call(`/repos/${id}/file/?path=${encodeURIComponent(path)}&start=${start}&end=${end}`)
export const listRepos = (ids) => call(`/repos/${ids ? `?ids=${ids.join(',')}` : ''}`)
export const getEvals = () => call('/evals/')

export function rememberedRepos() {
  try { return JSON.parse(localStorage.getItem('sift:repos') || '[]') } catch { return [] }
}

// Ask the agent and get each event as it happens (server-sent events over a POST).
export async function streamAgent(id, question, onEvent, signal) {
  const res = await fetch(`${BASE}/repos/${id}/agent/stream/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `Something went wrong (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut)
      buffer = buffer.slice(cut + 2)
      const data = block.split('\n').find((l) => l.startsWith('data: '))
      if (data) onEvent(JSON.parse(data.slice(6)))
    }
  }
}
