import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import Nav from '../components/Nav.jsx'
import { getEvals } from '../lib/api.js'
import '../styles/pages.css'

const MODES = [
  { key: 'keyword', label: 'Keyword search', color: '#FF7A3D', note: 'matches the exact words' },
  { key: 'vector', label: 'Vector search', color: '#3255A4', note: 'matches the meaning' },
  { key: 'hybrid', label: 'Hybrid (what Sift uses)', color: '#FF48B0', note: 'both, merged' },
]

export default function Evals() {
  const root = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { document.title = 'Evals on Sift'; getEvals().then(setData).catch((e) => setError(e.message)) }, [])

  useGSAP(() => {
    if (!data) return
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.ev-line', { scaleX: 0, transformOrigin: '0 50%', duration: 1.2, stagger: 0.2, ease: 'power3.inOut' })
      gsap.from('.ev-end', { scale: 0, duration: 0.5, stagger: 0.2, delay: 0.9, ease: 'back.out(3)' })
      gsap.from('.big-stamp', { scale: 2.4, rotation: 30, opacity: 0, duration: 0.35, stagger: 0.25, delay: 1.5, ease: 'power4.in' })
    })
  }, { scope: root, dependencies: [data] })

  return (
    <div className="page" ref={root}>
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main className="pg">
        <p className="kicker">Evals</p>
        <h1>Does it actually find the right code?</h1>
        <p className="lede">
          I wrote {data?.questions || 24} questions about {data?.repo || 'a real repo'} where I already knew which file held
          the answer. Then I checked whether search put that file in its top five results, and whether
          the agent's answers were right and backed by the lines it cited.
        </p>
        {error && <p className="pg-error">Couldn't load the latest run: {error}</p>}

        {data && (
          <div className="two">
            <section>
            <h2>Finding the right file</h2>
            <div className="ev-lines">
              {MODES.map((m) => (
                <div className="ev-row" key={m.key}>
                  <div className="ev-label"><b>{m.label}</b><span>{m.note}</span></div>
                  <div className="ev-track">
                    <div className="ev-line" style={{ width: `${data.retrieval[m.key]}%`, background: m.color }}>
                      <span className="ev-end">{data.retrieval[m.key]}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="hand-note">Vector search got every one on this set. Hybrid stays the default because it also catches exact names, like a function you type in.</p>

            </section>
            <section>
            <h2>Answering</h2>
            <div className="stamps">
              <div className="big-stamp"><b>{data.answers.correct_pct}%</b><span>correct</span></div>
              <div className="big-stamp pink"><b>{data.answers.grounded_pct}%</b><span>backed by<br />its citations</span></div>
            </div>
            <p className="small">Out of {data.answers.asked} questions. "Backed by its citations" means every claim pointed at lines that really say it.</p>
            <p className="small">Run it yourself: <code>python manage.py run_evals --answers</code></p>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
