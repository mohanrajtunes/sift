import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import MetroMap from '../components/MetroMap.jsx'
import Nav from '../components/Nav.jsx'
import HomeMore from '../components/HomeMore.jsx'
import { ANSWER, CODE, LINES, QUESTION, STOPS, TRY } from '../data/demoMap.js'
import { addRepo, rememberRepo } from '../lib/api.js'
import '../styles/home.css'

gsap.registerPlugin(useGSAP, DrawSVGPlugin, MotionPathPlugin)

// cycles example repos in the empty input, typed one letter at a time
function useTypedPlaceholder(words) {
  const [text, setText] = useState('owner/repo')
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let w = 0, i = 0, deleting = false, timer
    const tick = () => {
      const word = words[w]
      i += deleting ? -1 : 1
      setText(word.slice(0, i) || ' ')
      let wait = deleting ? 35 : 75
      if (!deleting && i === word.length) { deleting = true; wait = 1800 }
      if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; wait = 300 }
      timer = setTimeout(tick, wait)
    }
    timer = setTimeout(tick, 2600)
    return () => clearTimeout(timer)
  }, [words])
  return text
}

const EXAMPLES = ['owner/repo', ...TRY]

export default function Home() {
  const root = useRef(null)
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [state, setState] = useState('idle') // idle | boarding | error
  const [error, setError] = useState('')
  const placeholder = useTypedPlaceholder(EXAMPLES)

  async function board(value) {
    const repo = (value ?? url).trim()
    if (!repo) { setError('Paste a repo first, like pallets/flask.'); setState('error'); return }
    setState('boarding'); setError('')
    gsap.fromTo('.punch', { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(4)' })
    try {
      const full = repo.includes('github.com') ? repo : `https://github.com/${repo}`
      const data = await addRepo(full)
      rememberRepo(data.id)
      navigate(`/repo/${data.id}`)
    } catch (e) {
      setState('error'); setError(e.message === 'Failed to fetch' ? "Can't reach the Sift server right now. Try again in a minute." : e.message)
      gsap.fromTo('.ticket', { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2,0.25)' })
      gsap.to('.punch', { scale: 0, duration: 0.2, delay: 0.4 })
    }
  }

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: reduce)', () => {
      // no motion: show the finished story
      gsap.set('.nug-body', { scale: 1 })
      gsap.set('.st.cited .st-dot', { opacity: 0 })
      gsap.set('.stamp-in', { opacity: 1 })
      gsap.set('.word, .coin', { opacity: 1 })
      gsap.set('.spec-wait', { autoAlpha: 0 })
      gsap.set('.code .hl', { backgroundSize: '100% 100%' })
      gsap.set('.train', { opacity: 0 })
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const route = document.querySelector('.route')
      const onRoute = (start, end) => ({ path: route, align: route, alignOrigin: [0.5, 0.5], autoRotate: true, start, end })
      gsap.set('.nug-body', { scale: 0, transformOrigin: '50% 50%' })

      // ---- 1. the page prints itself ----
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('.big-blue', { y: -40, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)' })
        .from('.big-pink', { x: 70, y: -50, autoAlpha: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)' }, 0.15)
        .from('.kicker', { autoAlpha: 0, y: 10, duration: 0.5 }, 0.2)
        .from('.tag-line', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.6 }, 0.45)
        .from('.ticket-wrap', { y: 40, rotation: -5, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.7)' }, 0.7)
        .from('.try', { autoAlpha: 0, duration: 0.5 }, 1)
        .from('.line-path', { drawSVG: '0%', duration: 1.1, stagger: 0.12, ease: 'power2.inOut' }, 0.5)
        .from('.st-pop', { scale: 0, transformOrigin: '50% 50%', duration: 0.45, stagger: 0.035, ease: 'back.out(3)' }, 1.1)
        .from('.st-label', { autoAlpha: 0, duration: 0.4, stagger: 0.02 }, 1.3)
        .fromTo('.note', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.7, stagger: 0.35, ease: 'steps(9)' }, 1.8)
        .from('.arrow', { drawSVG: '0%', duration: 0.5, stagger: 0.35 }, 2.1)
        .from('.legend > *', { autoAlpha: 0, y: 8, stagger: 0.06, duration: 0.4 }, 2)
        .from('.spec', { y: 80, rotation: 8, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.5)' }, 1.6)
        .from('.pin', { y: -30, scale: 1.6, autoAlpha: 0, duration: 0.4, ease: 'bounce.out' }, 2.4)

      // ---- 2. the agent rides, on loop ----
      const stamp = (n) => gsap.timeline()
        .fromTo(`.stamp-${n} .stamp-in`,
          { scale: 2.4, opacity: 0, rotation: STOPS[n - 1].tilt + 25 },
          { scale: 1, opacity: 1, rotation: STOPS[n - 1].tilt, duration: 0.28, ease: 'power4.in' })
        .to(`.stamp-${n} .stamp-in`, { scale: 1.12, duration: 0.08, yoyo: true, repeat: 1 })

      const strike = (id, dotClass) => gsap.timeline()
        .to(`.${dotClass}`, { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.15 })
        .fromTo(`.nug-${id} .nug-body`, { scale: 0, rotation: -40, transformOrigin: '50% 50%' },
          { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(3.5)' }, '<')
        .fromTo(`.nug-${id} .spark`, { opacity: 1, y: 0, scale: 1 },
          { opacity: 0, y: -16, scale: 0.4, duration: 0.6, stagger: 0.02, ease: 'power2.out', immediateRender: false }, '<0.1')

      const ride = (from, to, duration) => gsap.timeline()
        .fromTo('.train', { motionPath: onRoute(from, from) }, { motionPath: onRoute(from, to), duration, ease: 'power1.inOut' })
        .fromTo('.trail-reveal', { drawSVG: `0% ${from * 100}%` }, { drawSVG: `0% ${to * 100}%`, duration, ease: 'power1.inOut' }, '<')

      const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true })
      loop
        .set('.train', { motionPath: onRoute(0, 0) })
        .set('.trail-reveal', { drawSVG: '0% 0%' })
        .set('.train', { autoAlpha: 1 })
        .fromTo('.train-pop', { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', immediateRender: false })
        .add(stamp(1))
        .add(ride(0, STOPS[1].at, 1.7), '+=0.35')
        .add(strike('views', 'st-dot-aiviews'))
        .add(stamp(2), '<0.1')
        .add(ride(STOPS[1].at, 1, 1.1), '+=0.4')
        .add(strike('services', 'st-dot-aiservices'))
        .add(stamp(3), '<0.1')
        .to('.train-body', { rotation: 8, duration: 0.07, yoyo: true, repeat: 5, transformOrigin: '50% 50%' }, '<') // happy wiggle
        .to('.spec-wait', { autoAlpha: 0, duration: 0.2 }, '+=0.1')
        .to('.word', { opacity: 1, duration: 0.2, stagger: 0.035 }, '<')
        .fromTo('.coin', { rotationY: 180, scale: 0.2, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: 0.5, stagger: 0.4, ease: 'back.out(2.5)' }, '<0.5')
        .to('.code .hl', { backgroundSize: '100% 100%', duration: 0.6, stagger: 0.12, ease: 'power2.out' }, '<0.3')
        .fromTo('.glint', { x: 0, opacity: 0.9 }, { x: 60, duration: 0.5, stagger: 0.15, immediateRender: false })
        .set('.glint', { opacity: 0 })
        .fromTo('.glint', { x: 0, opacity: 0.9 }, { x: 60, duration: 0.5, stagger: 0.15, immediateRender: false }, '+=1.6')
        .set('.glint', { opacity: 0 })
        // tidy up for the next ride
        .to('.word, .coin', { opacity: 0, duration: 0.4 }, '+=1.2')
        .to('.spec-wait', { autoAlpha: 1, duration: 0.3 }, '>')
        .to('.code .hl', { backgroundSize: '0% 100%', duration: 0.4 }, '<')
        .to('.stamp-in', { opacity: 0, scale: 0.6, duration: 0.3, stagger: 0.05 }, '<')
        .to('.train-pop', { scale: 0, duration: 0.3 }, '<')
        .set('.train', { autoAlpha: 0 }, '>')
        .to('.trail-reveal', { drawSVG: '100% 100%', duration: 0.6 }, '<')
        .to('.nug-body', { scale: 0, duration: 0.3 }, '<0.2')
        .to('.st.cited .st-dot', { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' }, '>-0.1')

      intro.call(() => loop.play(), null, 2.6)

      // the train bobs a little while it idles
      gsap.to('.train-body', { y: -1.5, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut' })

      // the pink ink drifts with your mouse, so the misprint feels alive
      const px = gsap.quickTo('.big-pink', 'x', { duration: 0.6, ease: 'power3' })
      const py = gsap.quickTo('.big-pink', 'y', { duration: 0.6, ease: 'power3' })
      const move = (e) => {
        px((e.clientX / window.innerWidth - 0.5) * 18)
        py((e.clientY / window.innerHeight - 0.5) * 12)
      }
      window.addEventListener('pointermove', move)
      return () => window.removeEventListener('pointermove', move)
    })
  }, { scope: root })

  const swing = () => {
    // one swing at a time: the pin moves with the card, so hovering it kept restarting the swing
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || gsap.isTweening('.spec')) return
    gsap.fromTo('.spec', { rotation: 6 }, { rotation: -1.2, duration: 1.6, ease: 'elastic.out(1, 0.3)' })
  }

  return (
    <div className="home" ref={root}>
      <div className="grain" aria-hidden="true" />

      <Nav />

      <main className="hero">
        <section className="plate">
          <p className="kicker">A field guide to any codebase</p>
          <h1 className="big" aria-label="Sift">
            <span className="big-pink" aria-hidden="true">sift</span>
            <span className="big-blue" aria-hidden="true">sift</span>
          </h1>
          <p className="tag">
            <span className="tag-line">Ask a repo anything.</span>{' '}
            <span className="tag-line"><i>Sift shows you exactly</i></span>{' '}
            <span className="tag-line"><i>where the answer lives.</i></span>
          </p>

          <form className="ticket-wrap" onSubmit={(e) => { e.preventDefault(); board() }}>
            <div className="ticket-shadow ht-pink" aria-hidden="true" />
            <div className="ticket">
              <label className="ticket-in">
                <span className="ticket-label">Paste a public GitHub repo</span>
                <span className="ticket-field">
                  <span className="prefix">github.com/</span>
                  <input value={url} onChange={(e) => { setUrl(e.target.value); setState('idle') }}
                    placeholder={placeholder} spellCheck="false" autoComplete="off" aria-label="GitHub repo" />
                </span>
              </label>
              <button className="ticket-go" type="submit" disabled={state === 'boarding'}>
                <span className="punch" aria-hidden="true" />
                {state === 'boarding' ? 'Boarding…' : 'Index it'}
              </button>
            </div>
            {state === 'error' && <p className="ticket-error" role="alert">{error}</p>}
          </form>

          <p className="try">
            No repo handy? Hop on one:
            {TRY.map((t) => (
              <button key={t} type="button" onClick={() => { setUrl(t); board(t) }}>{t}</button>
            ))}
          </p>
        </section>

        <section className="stage">
          <MetroMap />

          <article className="spec" aria-label="Example answer">
            <div className="spec-back ht-yellow" aria-hidden="true" />
            <div className="card">
              <button className="pin" type="button" aria-label="Give the card a nudge" onMouseEnter={swing} onClick={swing} />
              <div className="spec-hd"><span>Specimen from mohanrajtunes/hirelens</span><span>3 stops, 4.2 s</span></div>
              <h2>{QUESTION}</h2>
              <p className="spec-answer">
                <span className="spec-wait" aria-hidden="true">the agent is still riding…</span>
                {ANSWER.map((part, i) => typeof part === 'string'
                  ? part.split(' ').map((w, j) => <span className="word" key={`${i}-${j}`}>{w}{' '}</span>)
                  : <span className="coin" key={i}>{part.cite}</span>)}
              </p>
              <div className="code">
                {CODE.map((l) => (
                  <div key={l.n} className={l.hl ? 'hl' : ''}><span className="ln">{l.n}</span>{l.text}</div>
                ))}
              </div>
            </div>
          </article>

          <ul className="legend">
            {LINES.map((l) => <li key={l.id}><i style={{ background: l.color }} />{l.label}</li>)}
            <li>
              <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9l6-5 6 3 1 7-7 3-6-3z" fill="#F2B925" stroke="#9A6400" /></svg>
              cited
            </li>
          </ul>
        </section>
      </main>
      <HomeMore />
    </div>
  )
}
