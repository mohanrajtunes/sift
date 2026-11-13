import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Wipe from './components/Wipe.jsx'
import Footer from './components/Footer.jsx'
import Cat from './components/Cat.jsx'

// only the home page loads up front; the rest load when you go there
const Repo = lazy(() => import('./pages/Repo.jsx'))
const Repos = lazy(() => import('./pages/Repos.jsx'))
const Evals = lazy(() => import('./pages/Evals.jsx'))
const Built = lazy(() => import('./pages/Built.jsx'))
import Nav from './components/Nav.jsx'
import './styles/pages.css'

function Lost() {
  return (
    <div className="page">
      <Nav />
      <main className="pg">
        <h1>Wrong platform.</h1>
        <p className="hand-note">No train stops here. <Link to="/">Head back home</Link>.</p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<div className="page" />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/repo/:id" element={<Repo />} />
      <Route path="/repos" element={<Repos />} />
      <Route path="/evals" element={<Evals />} />
      <Route path="/built" element={<Built />} />
      <Route path="*" element={<Lost />} />
    </Routes>
    <Footer />
    <Wipe />
    <Cat />
    </Suspense>
  )
}
