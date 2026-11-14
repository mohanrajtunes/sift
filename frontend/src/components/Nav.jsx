import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import '../styles/nav.css'

export function Logo() {
  return (
    <svg className="logo-mark" width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="10.5" stroke="#1D2A5C" strokeWidth="2.4" />
      <path d="M5.5 10h15M4 15h18M10 4.5v17M16 4.5v17" stroke="#1D2A5C" strokeWidth="1.3" />
      <path className="logo-nug" d="M15 13.6l2.6-.8 1.3 2.2-1.8 2-2.6-.6z" fill="#F2B925" stroke="#9A6400" strokeWidth=".6" />
    </svg>
  )
}

export default function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  return (
    <nav className={`nav${open ? ' open' : ''}`}>
      <Link className="logo" to="/"><Logo />sift</Link>
      <span className="sp" />
      <div className="nav-links" id="nav-links">
        <NavLink to="/built">How it's built</NavLink>
        <NavLink to="/evals">Evals</NavLink>
        <NavLink to="/repos">Your repos</NavLink>
        <a className="gh" href="https://github.com/mohanrajtunes/sift" target="_blank" rel="noreferrer">GitHub</a>
      </div>
      <button className="burger" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="nav-links"
        onClick={() => setOpen((o) => !o)}>
        <span /><span /><span />
      </button>
    </nav>
  )
}
