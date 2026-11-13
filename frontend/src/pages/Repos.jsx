import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { listRepos, rememberedRepos } from '../lib/api.js'
import '../styles/pages.css'

function Ticket({ r }) {
  return (
    <li>
      <Link className="rticket" to={`/repo/${r.id}`}>
        <span className="rt-name">{r.name}</span>
        <span className="rt-meta">{r.status === 'ready' ? `${r.file_count} files` : r.status}</span>
        <span className="rt-go">Ride</span>
      </Link>
    </li>
  )
}

export default function Repos() {
  const [mine, setMine] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Your repos on Sift'
    const ids = rememberedRepos()
    Promise.all([ids.length ? listRepos(ids) : Promise.resolve([]), listRepos()])
      .then(([m, r]) => { setMine(m); setRecent(r.filter((x) => !ids.includes(x.id))) })
      .catch((e) => { setMine([]); setError(e.message === 'Failed to fetch' ? "Can't reach the Sift server." : e.message) })
  }, [])

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main className="pg">
        <p className="kicker">Your repos</p>
        <h1>Your tickets</h1>
        <p className="lede">Repos you've added from this browser. No account needed, so they live here, not in a profile.</p>
        {error && <p className="pg-error">{error}</p>}
        {mine && mine.length === 0 && !error && (
          <p className="hand-note">Nothing here yet. <Link to="/">Paste a repo on the home page</Link> and it'll show up.</p>
        )}
        {mine && mine.length > 0 && <ul className="rtickets">{mine.map((r) => <Ticket key={r.id} r={r} />)}</ul>}
        {recent.length > 0 && (
          <>
            <h2>Recently indexed by others</h2>
            <ul className="rtickets">{recent.map((r) => <Ticket key={r.id} r={r} />)}</ul>
          </>
        )}
      </main>
    </div>
  )
}
