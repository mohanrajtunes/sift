import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import Nav from '../components/Nav.jsx'
import '../styles/pages.css'

const STOPS = [
  ['Download', 'Grabs the repo from GitHub as one zip, up to 50 MB.'],
  ['Filter', 'Skips node_modules, build folders, images, lock files and anything over 200 KB.'],
  ['Chunk', 'Python is cut along its functions and classes. Everything else goes in overlapping 60-line windows.'],
  ['Embed', 'Each chunk becomes a list of 768 numbers with Gemini, so similar code lands close together.'],
  ['Store', 'Chunks and their vectors live in Postgres, using pgvector.'],
  ['Search', 'A keyword search and a vector search run side by side, and their rankings are merged (reciprocal rank fusion).'],
  ['Agent', 'The model gets three tools: search the code, open a file, find where a name is used. It rides around for up to six steps.'],
  ['Answer', 'Every claim has to cite a numbered excerpt it actually saw. Made-up citation numbers get dropped.'],
]
const STACK = ['Django REST Framework', 'Postgres + pgvector on Neon', 'Gemini embeddings', 'Groq, gpt-oss-120b', 'React, GSAP', 'Server-sent events for the live steps']
const COLORS = ['#3255A4', '#3255A4', '#00A95C', '#00A95C', '#00A95C', '#FF7A3D', '#FF48B0', '#FF48B0']

export default function Built() {
  const root = useRef(null)
  useEffect(() => { document.title = "How Sift is built" }, [])

  useGSAP(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.bl-stop h3, .bl-stop > p', { x: -30, autoAlpha: 0, duration: 0.6, stagger: 0.09, ease: 'power3.out' })
      gsap.from('.bl-rail', { scaleY: 0, transformOrigin: '50% 0', duration: 1.4, ease: 'power2.inOut' })
      const dots = gsap.utils.toArray('.bl-dot')
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, delay: 1.2 })
      dots.forEach((d, i) => {
        const y = d.offsetTop + d.offsetHeight / 2
        tl.to('.bl-train', { y, duration: i ? 0.7 : 0.01, ease: 'power2.inOut' })
          .fromTo(d, { scale: 1 }, { scale: 1.6, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' })
      })
      tl.to('.bl-train', { autoAlpha: 0, duration: 0.3 }).set('.bl-train', { y: 0 }).to('.bl-train', { autoAlpha: 1, duration: 0.3 })
    })
  }, { scope: root })

  return (
    <div className="page" ref={root}>
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main className="pg">
        <p className="kicker">How it's built</p>
        <h1>From a GitHub link to an answer with receipts</h1>
        <p className="lede">Two trips. The first happens once, when you add a repo. The second happens every time you ask something.</p>

        <div className="two built">
        <div className="bl">
          <div className="bl-rail" aria-hidden="true" />
          <div className="bl-train" aria-hidden="true"><span /></div>
          <ol>
            {STOPS.map(([name, text], i) => (
              <li className="bl-stop" key={name}>
                {i === 0 && <p className="bl-trip">Trip 1: indexing</p>}
                {i === 5 && <p className="bl-trip">Trip 2: every question</p>}
                <span className="bl-dot" style={{ borderColor: COLORS[i] }} />
                <h3>{name}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="parts">
          <h2>The parts</h2>
          <ul className="chips">{STACK.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="hand-note">Hybrid search plus an agent that has to cite its lines. That's the whole trick.</p>
          <p className="small">The code is on <a href="https://github.com/mohanrajtunes/sift" target="_blank" rel="noreferrer">GitHub</a>.</p>
        </aside>
        </div>
      </main>
    </div>
  )
}
