import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import Nav from '../components/Nav.jsx'
import RepoMap from '../components/RepoMap.jsx'
import { addRepo, getFile, getGraph, getRepo, streamAgent } from '../lib/api.js'
import '../styles/repo.css'

// starter questions made from the repo's own files
function starters(graph) {
  const names = graph.nodes.map((n) => n.id)
  const base = (p) => p.split('/').pop()
  const indeg = {}
  graph.edges.forEach((e) => { indeg[e.target] = (indeg[e.target] || 0) + 1 })
  const hub = Object.entries(indeg).sort((a, b) => b[1] - a[1])[0]?.[0]
  const entry = names.find((p) => ['manage.py', 'main.py', 'app.py', 'server.js', 'main.jsx', 'main.tsx', 'index.js'].includes(base(p)))
  const auth = names.find((p) => /auth|login|token|session/i.test(p))
  const db = names.find((p) => /models?\.py$|schema|prisma|migration|db\./i.test(p))
  return [
    entry ? `What happens when ${base(entry)} runs?` : 'Where does the app start?',
    hub ? `What does ${base(hub)} do, and what uses it?` : 'Which files matter most here?',
    auth ? `How does ${base(auth)} handle login?` : db ? `What is stored in ${base(db)}?` : 'What talks to the database?',
  ]
}

function stats(graph) {
  const ext = {}
  graph.nodes.forEach((n) => { const e = n.id.includes('.') ? n.id.split('.').pop().toLowerCase() : 'other'; ext[e] = (ext[e] || 0) + n.lines })
  const total = Object.values(ext).reduce((a, b) => a + b, 0) || 1
  const langs = Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e, l]) => ({ e, pct: Math.round((l / total) * 100) }))
  const biggest = [...graph.nodes].sort((a, b) => b.lines - a.lines).slice(0, 3)
  const indeg = {}
  graph.edges.forEach((e) => { indeg[e.target] = (indeg[e.target] || 0) + 1 })
  const hub = Object.entries(indeg).sort((a, b) => b[1] - a[1])[0]
  return { langs, biggest, hub, lines: total, imports: graph.edges.length }
}

const LANG_INKS = ['#3255A4', '#FF48B0', '#00A95C', '#FF7A3D', '#765BA7', '#D9A400']

function Stats({ graph, onFocus }) {
  const s = stats(graph)
  return (
    <div className="rp-stats">
      <div className="langbar" aria-label="Lines by file type">
        {s.langs.map((l, i) => <span key={l.e} style={{ width: `${l.pct}%`, background: LANG_INKS[i] }} title={`.${l.e} ${l.pct}%`} />)}
      </div>
      <ul className="langs">{s.langs.map((l, i) => <li key={l.e}><i style={{ background: LANG_INKS[i] }} />.{l.e} {l.pct}%</li>)}</ul>
      <dl>
        <div><dt>Lines</dt><dd>{s.lines.toLocaleString()}</dd></div>
        <div><dt>Imports</dt><dd>{s.imports}</dd></div>
        {s.hub && <div><dt>Most used</dt><dd><button onClick={() => onFocus(s.hub[0])}>{s.hub[0].split('/').pop()}</button> <small>by {s.hub[1]} files</small></dd></div>}
        <div><dt>Biggest</dt><dd>{s.biggest.map((b) => <button key={b.id} onClick={() => onFocus(b.id)}>{b.id.split('/').pop()}</button>)}</dd></div>
      </dl>
    </div>
  )
}

function FileSearch({ graph, onFocus }) {
  const [q, setQ] = useState('')
  const hits = q.trim().length < 2 ? [] : graph.nodes.filter((n) => n.id.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
  return (
    <div className="fsearch">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a file on the map…" aria-label="Find a file" />
      {hits.length > 0 && (
        <ul>{hits.map((h) => <li key={h.id}><button onClick={() => { onFocus(h.id); setQ('') }}>{h.id}</button></li>)}</ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="fs-none">No file matches that.</p>}
    </div>
  )
}

function copyAnswer(turn) {
  const src = turn.sources.map((s) => `[${s.n}] ${s.path} lines ${s.start_line}-${s.end_line}: ${s.url}`).join('\n')
  return navigator.clipboard.writeText(`Q: ${turn.question}\n\n${turn.text}\n\nSources:\n${src}`)
}

const TOOL_WORDS = {
  search_code: (a) => <>Searched for <code>{a.query}</code></>,
  read_file: (a) => <>Opened <code>{a.path}</code></>,
  find_references: (a) => <>Looked up where <code>{a.name}</code> is used</>,
}

// very small markdown: paragraphs, bullets, `code`, **bold**, and [n] citations as gold coins
function Inline({ text, onCite }) {
  const parts = text.split(/(\[\d+\]|`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (/^\[\d+\]$/.test(p)) {
      const n = Number(p.slice(1, -1))
      return <button key={i} className="coin" onClick={() => onCite(n)} aria-label={`Show source ${n}`}>{n}</button>
    }
    if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    if (p.startsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    return p
  })
}

function Answer({ text, onCite }) {
  return text.split(/\n{2,}/).map((block, i) => {
    const lines = block.split('\n')
    if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
      return <ul key={i}>{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*([-*]|\d+\.)\s/, '')} onCite={onCite} /></li>)}</ul>
    }
    return <p key={i}><Inline text={block} onCite={onCite} /></p>
  })
}

function CodePanel({ repoId, source, onClose }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setFile(null); setError('')
    getFile(repoId, source.path, Math.max(1, source.start_line - 3), source.end_line + 3)
      .then(setFile).catch((e) => setError(e.message))
  }, [repoId, source.path, source.start_line, source.end_line])

  return (
    <div className="codepanel">
      <div className="cp-head">
        <span className="coin static">{source.n}</span>
        <b>{source.path}</b>
        <span>lines {source.start_line} to {source.end_line}</span>
        <a href={source.url} target="_blank" rel="noreferrer">GitHub</a>
        <button onClick={onClose} aria-label="Close code">✕</button>
      </div>
      {error && <p className="cp-msg">{error}</p>}
      {!file && !error && <p className="cp-msg">Fetching the lines…</p>}
      {file && (
        <pre>
          {file.lines.map((l) => {
            const hl = l.n >= source.start_line && l.n <= source.end_line
            return <div key={l.n} className={hl ? 'hl' : ''}><span className="ln">{l.n}</span>{l.text || ' '}</div>
          })}
        </pre>
      )}
    </div>
  )
}

function CopyBtn({ turn }) {
  const [done, setDone] = useState(false)
  return (
    <button className="copy" onClick={() => copyAnswer(turn).then(() => { setDone(true); setTimeout(() => setDone(false), 1800) })}>
      {done ? 'Copied, with sources' : 'Copy answer'}
    </button>
  )
}

function Turn({ turn, repoId, onCite, open }) {
  return (
    <article className="turn">
      <h2>{turn.question}</h2>
      {turn.steps.length > 0 && (
        <ol className="steps">
          {turn.steps.map((s) => (
            <li key={s.i} className={s.status}>
              <span className="stamp">{s.i}</span>
              <span>{(TOOL_WORDS[s.tool] || (() => s.tool))(s.args || {})}{s.note && <em> {s.note}</em>}</span>
            </li>
          ))}
        </ol>
      )}
      {turn.text
        ? <div className="answer"><Answer text={turn.text} onCite={(n) => onCite(turn, n)} />{turn.live && <span className="caret" />}</div>
        : turn.live && <p className="thinking">{turn.steps.length ? 'Reading…' : 'Looking around the repo…'}</p>}
      {turn.error && <p className="turn-error">{turn.error}</p>}
      {open && open.turn === turn.id && <CodePanel repoId={repoId} source={open.source} onClose={() => onCite(null)} />}
      {turn.done && <CopyBtn turn={turn} />}
      {turn.done && turn.sources.length === 0 && !turn.error && (
        <p className="nosrc">No sources cited for this one, so take it with a pinch of salt.</p>
      )}
    </article>
  )
}

export default function Repo() {
  const { id } = useParams()
  const [repo, setRepo] = useState(null)
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [loadError, setLoadError] = useState('')
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)
  const [focus, setFocus] = useState(null)
  const threadRef = useRef(null)

  // load the repo; while it indexes, keep checking so the map can grow
  useEffect(() => {
    let alive = true, timer
    const load = async () => {
      try {
        const [r, g] = await Promise.all([getRepo(id), getGraph(id)])
        if (!alive) return
        setRepo(r); setGraph(g)
        if (r.status === 'queued' || r.status === 'indexing') timer = setTimeout(load, 2500)
      } catch (e) { if (alive) setLoadError(e.message === 'Failed to fetch' ? "Can't reach the Sift server." : e.message) }
    }
    load()
    return () => { alive = false; clearTimeout(timer) }
  }, [id])

  useEffect(() => { document.title = repo ? `${repo.name} on Sift` : 'Sift' }, [repo])

  const last = turns[turns.length - 1]
  const visited = [...new Set(turns.flatMap((t) => t.steps.flatMap((s) => s.files || [])))]
  const cited = [...new Set(last ? last.sources.map((s) => s.path) : [])]
  const at = last ? (last.steps.filter((s) => s.files?.length).pop()?.files[0] || null) : null

  const update = (tid, fn) => setTurns((ts) => ts.map((t) => (t.id === tid ? fn(t) : t)))

  async function ask(q) {
    const text = (q ?? question).trim()
    if (!text || busy) return
    const tid = Date.now()
    setTurns((ts) => [...ts, { id: tid, question: text, steps: [], text: '', sources: [], live: true, done: false }])
    setQuestion(''); setBusy(true); setOpen(null)
    setTimeout(() => threadRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    try {
      await streamAgent(id, text, (ev) => {
        if (ev.type === 'step') {
          update(tid, (t) => ({ ...t, steps: [...t.steps.filter((s) => s.i !== ev.i), ev].sort((a, b) => a.i - b.i) }))
          if (ev.status === 'running') {
            requestAnimationFrame(() => gsap.fromTo('.turn:last-child .steps li:last-child .stamp',
              { scale: 2.2, rotation: 25, opacity: 0 }, { scale: 1, rotation: -6, opacity: 1, duration: 0.3, ease: 'power4.in' }))
          }
        } else if (ev.type === 'token') update(tid, (t) => ({ ...t, text: t.text + ev.t }))
        else if (ev.type === 'reset') update(tid, (t) => ({ ...t, text: '' }))
        else if (ev.type === 'done') update(tid, (t) => ({ ...t, text: ev.answer, sources: ev.sources, live: false, done: true }))
        else if (ev.type === 'error') update(tid, (t) => ({ ...t, error: ev.detail, live: false }))
      })
    } catch (e) {
      update(tid, (t) => ({ ...t, error: e.message === 'Failed to fetch' ? "Can't reach the Sift server." : e.message, live: false }))
    } finally {
      update(tid, (t) => ({ ...t, live: false }))
      setBusy(false)
    }
  }

  function cite(turn, n) {
    if (!turn) return setOpen(null)
    const source = turn.sources.find((s) => s.n === n)
    if (source) setOpen({ turn: turn.id, source })
  }

  async function retry() {
    try { const r = await addRepo(repo.url); setRepo(r); setLoadError('') } catch (e) { setLoadError(e.message) }
  }

  const ready = repo?.status === 'ready'

  return (
    <div className="repo-page">
      <div className="grain" aria-hidden="true" />
      <Nav />
      <header className="rp-head">
        {repo ? (
          <>
            <h1>{repo.name}</h1>
            <span className={`status ${repo.status}`}>
              {ready && <>{repo.file_count} files indexed</>}
              {(repo.status === 'queued' || repo.status === 'indexing') && <>Indexing… {repo.file_count || graph.nodes.length} files so far</>}
              {repo.status === 'failed' && <>Indexing failed</>}
            </span>
            <a href={repo.url} target="_blank" rel="noreferrer">Open on GitHub</a>
          </>
        ) : !loadError && <h1 className="loading">Finding the repo…</h1>}
      </header>
      {loadError && <p className="rp-error">{loadError}</p>}
      {repo?.status === 'failed' && (
        <p className="rp-error">{repo.error || 'Something broke while indexing.'} <button onClick={retry}>Try again</button></p>
      )}

      <main className="rp-grid">
        <section className="rp-map">
          {graph.nodes.length > 0 && <FileSearch graph={graph} onFocus={setFocus} />}
          <RepoMap graph={graph} visited={visited} cited={cited} at={at} focus={focus}
            onPick={(path) => ready && !busy && setQuestion(`What does ${path} do?`)} />
          <ul className="rp-legend">
            <li><i className="dot" />not visited</li>
            <li><i className="dot visited" />the agent read it</li>
            <li><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9l6-5 6 3 1 7-7 3-6-3z" fill="#F2B925" stroke="#9A6400" /></svg>cited in the answer</li>
            <li>Click a station to ask about it.</li>
          </ul>
          {graph.nodes.length > 0 && <Stats graph={graph} onFocus={setFocus} />}
        </section>

        <section className="rp-chat">
          <div className="thread" ref={threadRef}>
            {turns.length === 0 && (
              <div className="empty">
                <p className="hand">{ready ? 'Ask it something. Here are a few to start:' : 'Hang on, the train is still being built.'}</p>
                {ready && starters(graph).map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
            {turns.map((t) => <Turn key={t.id} turn={t} repoId={id} onCite={cite} open={open} />)}
          </div>

          <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask() }}>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500}
              placeholder={ready ? 'Ask about this repo…' : 'You can ask once indexing is done'} disabled={!ready}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }} aria-label="Your question" />
            <button type="submit" disabled={!ready || busy || !question.trim()}>{busy ? 'Riding…' : 'Ask'}</button>
          </form>
        </section>
      </main>
    </div>
  )
}
