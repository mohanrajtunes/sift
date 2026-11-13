import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NuggetGame from './NuggetGame.jsx'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const STOPS = [
  { n: 1, title: 'Index', color: '#3255A4', text: 'Paste a public repo. Sift downloads it, cuts the code into pieces along functions and classes, and turns each piece into a vector.' },
  { n: 2, title: 'Search', color: '#00A95C', text: 'Your question runs through keyword search and vector search at the same time. The two rankings get merged, so exact names and fuzzy meaning both count.' },
  { n: 3, title: 'Answer', color: '#FF48B0', text: 'An agent opens files and follows references until it knows. Every claim it makes points at the lines it read.' },
]

const CARDS = [
  { q: 'How long does a login last?', a: 'Access tokens last 15 minutes. Refresh tokens last a day, and every refresh hands out a new one.', file: 'backend/config/settings.py' },
  { q: 'What can I upload as a resume?', a: 'PDFs only, up to 2 MB. The text gets pulled out and saved, so the file itself can go.', file: 'backend/resumes/views.py' },
  { q: 'How many times can someone try to log in?', a: 'Five times a minute. Signing up is capped at ten an hour.', file: 'backend/config/settings.py' },
  { q: 'How is the match score worked out?', a: '40% comes from requirements the resume proves with a real quote, 60% from the model judging the overall fit.', file: 'backend/ai/views.py' },
]

function Flip({ card, i }) {
  const [open, setOpen] = useState(false)
  return (
    <button className={`flip${open ? ' open' : ''}`} onClick={() => setOpen(!open)} style={{ '--tilt': `${[-2, 1.5, -1, 2][i]}deg` }}
      aria-label={open ? `Answer: ${card.a}` : `Question: ${card.q}. Flip to see the answer.`}>
      <span className="flip-in">
        <span className="flip-front">
          <span className="flip-q">{card.q}</span>
          <span className="flip-hint">tap to flip</span>
        </span>
        <span className="flip-back">
          <span className="flip-a">{card.a}</span>
          <span className="flip-src"><span className="gold-dot" />{card.file}</span>
        </span>
      </span>
    </button>
  )
}

export default function HomeMore() {
  const root = useRef(null)
  useGSAP(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray('.hm-reveal').forEach((el) => {
        gsap.from(el.children, { y: 40, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%' } })
      })
      gsap.from('.hm-rail', { scaleX: 0, transformOrigin: '0 50%', duration: 1.2, ease: 'power2.inOut', scrollTrigger: { trigger: '.hm-stops', start: 'top 80%' } })
      gsap.from('.strip-num', { textContent: 0, duration: 1.4, snap: { textContent: 1 }, ease: 'power2.out', scrollTrigger: { trigger: '.strip', start: 'top 85%' } })
    })
  }, { scope: root })

  return (
    <div className="hm" ref={root}>
      <section className="hm-sec">
        <h2 className="hm-h">Three stops, every question</h2>
        <div className="hm-stops hm-reveal">
          <div className="hm-rail" aria-hidden="true" />
          {STOPS.map((s) => (
            <div className="hm-stop" key={s.n}>
              <span className="hm-dot" style={{ borderColor: s.color }}>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hm-sec">
        <h2 className="hm-h">Questions people ask a repo</h2>
        <p className="hm-sub">Real answers from mohanrajtunes/hirelens. Flip a card.</p>
        <div className="flips hm-reveal">{CARDS.map((c, i) => <Flip key={c.q} card={c} i={i} />)}</div>
      </section>

      <section className="strip">
        <div className="strip-in hm-reveal">
          <p><b className="strip-num">96</b><span>% of test questions find the right file in the top five</span></p>
          <p><b className="strip-num">96</b><span>% of answers right, out of 23 checked by hand</span></p>
          <p><b className="strip-num">24</b><span>questions in the test set, all from a real repo</span></p>
        </div>
        <Link className="strip-link" to="/evals">See how it was tested</Link>
      </section>

      <section className="hm-sec about hm-reveal">
        <NuggetGame />
        <div>
          <h2 className="hm-h">Why I built this</h2>
          <p>Opening a new codebase is the slowest part of joining a project. You grep, you guess, you ask someone. I wanted a tool that reads the code with you and never makes things up, so every answer here has to show the lines it came from.</p>
          <p className="hand-sign">Mohanraj S</p>
        </div>
      </section>
    </div>
  )
}
