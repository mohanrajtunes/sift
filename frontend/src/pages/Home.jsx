import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import CityHero, { CITY_STOPS, DISTRICTS } from '../components/CityHero.jsx'
import Nav from '../components/Nav.jsx'
import HomeMore from '../components/HomeMore.jsx'
import { ANSWER, CODE, QUESTION, TRY } from '../data/demoMap.js'
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
  const loopRef = useRef(null)
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
      gsap.set('.bld-b2 .roof-gold, .bld-b3 .roof-gold', { opacity: 1 })
      gsap.set('.blabel', { autoAlpha: 1 })
      gsap.set('.stamp-in', { opacity: 1 })
      gsap.set('.word, .coin', { opacity: 1 })
      gsap.set('.spec-wait', { autoAlpha: 0 })
      gsap.set('.code .hl', { backgroundSize: '100% 100%' })
      gsap.set('.train', { opacity: 0 })
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // ---- 1. the page prints itself ----
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('.big-blue', { y: -40, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)' })
        .from('.big-pink', { x: 70, y: -50, autoAlpha: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)' }, 0.15)
        .from('.kicker', { autoAlpha: 0, y: 10, duration: 0.5 }, 0.2)
        .from('.tag-line', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.6 }, 0.45)
        .from('.ticket-wrap', { y: 40, rotation: -5, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.7)' }, 0.7)
        .from('.try', { autoAlpha: 0, duration: 0.5 }, 1)
        .from('.city-ground', { autoAlpha: 0, y: 30, duration: 0.8 }, 0.4)
        .from('.bld-in', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.05, ease: 'back.out(1.6)' }, 0.7)
        .from('.win', { opacity: 0, duration: 0.3, stagger: { each: 0.004, from: 'random' }, clearProps: 'opacity' }, 1.3)
        .from('.legend > *', { autoAlpha: 0, y: 8, stagger: 0.06, duration: 0.4 }, 2)
        .from('.spec', { y: 80, rotation: 8, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.5)' }, 1.6)
        .from('.pin', { y: -30, scale: 1.6, autoAlpha: 0, duration: 0.4, ease: 'bounce.out' }, 2.4)

      // ---- 2. the agent rides, on loop ----
      const stamp = (n) => gsap.timeline()
        .fromTo(`.stamp-${n} .stamp-in`,
          { scale: 2.4, opacity: 0, rotation: CITY_STOPS[n - 1].tilt + 25 },
          { scale: 1, opacity: 1, rotation: CITY_STOPS[n - 1].tilt, duration: 0.28, ease: 'power4.in' })
        .to(`.stamp-${n} .stamp-in`, { scale: 1.12, duration: 0.08, yoyo: true, repeat: 1 })

      // the express hops roof to roof, leaving a gold trail
      const ride = (i, duration) => {
        const t = gsap.timeline().to('.train', {
          motionPath: { path: `#hop-${i}`, align: `#hop-${i}`, alignOrigin: [0.5, 0.5] },
          duration, ease: i === 0 ? 'power2.in' : 'power1.inOut',
        })
        if (i > 0) t.fromTo(`.city-trail-${i}`, { drawSVG: '0%' }, { drawSVG: '100%', duration, ease: 'power1.inOut' }, '<')
        return t
      }
      // the building takes the landing, its lights come on, its name pops up
      const land = (id) => gsap.timeline()
        .fromTo(`.bld-${id} .bld-in`, { scaleY: 0.88, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' })
        .fromTo('.train-body', { scaleX: 1.3, scaleY: 0.75, transformOrigin: '50% 100%' }, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, '<')
        .to(`.bld-${id} .win`, { fill: '#FFE24A', opacity: 1, duration: 0.05, stagger: { each: 0.018, from: 'random' } }, '<')
        .fromTo(`.blabel-${id}`, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '<0.1')
      // a cited file: the roof turns to gold
      const strike = (id) => gsap.timeline()
        .to(`.bld-${id} .roof-gold`, { opacity: 1, duration: 0.35 })

        .fromTo(`.spk-${id} .spark`, { opacity: 1, y: 0, scale: 1 },
          { opacity: 0, y: -18, scale: 0.4, duration: 0.6, stagger: 0.02, ease: 'power2.out', immediateRender: false }, '<')

      const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true })
      loopRef.current = loop
      loop
        .set('.city-trail', { drawSVG: '0%' })
        .set('.train', { autoAlpha: 1 })
        .fromTo('.train-pop', { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false })
        .add(ride(0, 0.6), '<')
        .add(land('c1'))
        .add(stamp(1), '<')
        .add(ride(1, 1.4), '+=0.5')
        .add(land('b2'))
        .add(strike('b2'), '<')
        .add(stamp(2), '<0.1')
        .add(ride(2, 0.9), '+=0.5')
        .add(land('b3'))
        .add(strike('b3'), '<')
        .add(stamp(3), '<0.1')
        .to('.train-body', { rotation: 8, duration: 0.07, yoyo: true, repeat: 5, transformOrigin: '50% 50%' }, '<') // happy wiggle
        .to('.spec-wait', { autoAlpha: 0, duration: 0.2 }, '+=0.1')
        .to('.word', { opacity: 1, duration: 0.2, stagger: 0.035 }, '<')
        .fromTo('.coin', { rotationY: 180, scale: 0.2, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: 0.5, stagger: 0.4, ease: 'back.out(2.5)' }, '<0.5')
        .to('.code .hl', { backgroundSize: '100% 100%', duration: 0.6, stagger: 0.12, ease: 'power2.out' }, '<0.3')
        // tidy up for the next ride
        .to('.word, .coin', { opacity: 0, duration: 0.4 }, '+=2.6')
        .to('.spec-wait', { autoAlpha: 1, duration: 0.3 }, '>')
        .to('.code .hl', { backgroundSize: '0% 100%', duration: 0.4 }, '<')
        .to('.stamp-in', { opacity: 0, scale: 0.6, duration: 0.3, stagger: 0.05 }, '<')
        .to('.blabel', { autoAlpha: 0, duration: 0.3 }, '<')
        .to('.train-pop', { scale: 0, duration: 0.3 }, '<')
        .set('.train', { autoAlpha: 0 }, '>')
        .to('.city-trail', { drawSVG: '100% 100%', duration: 0.6 }, '<')
        .to('.roof-gold', { opacity: 0, duration: 0.4 }, '<0.2')
        .to('.win', { fill: '#ECEDE6', opacity: 0.75, duration: 0.4, clearProps: 'fill,opacity' }, '<')

      intro.call(() => loop.play(), null, 3)

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

  // a coin in the card points at the building it cites
  const pointRef = useRef(null)
  const point = (n) => {
    const id = n === 1 ? 'b2' : 'b3'
    pointRef.current?.revert()
    pointRef.current = gsap.timeline()
      .to('.bld, .city-trail, .blabel, .cstamp, .train', { opacity: 0.18, duration: 0.25 })
      .to(`.bld-${id}, .blabel-${id}`, { opacity: 1, duration: 0.25 }, '<')
      .to(`.bld-${id} .bld-in`, { y: -16, duration: 0.35, ease: 'back.out(3)' }, '<')
      .to(`.bld-${id} .roof-gold`, { opacity: 1, duration: 0.25 }, '<')
      .to(`.bld-${id} .win`, { fill: '#FFE24A', opacity: 1, duration: 0.2 }, '<')
      .to(`.blabel-${id}`, { autoAlpha: 1, y: -16, duration: 0.3 }, '<')
      .fromTo(`.spk-${id} .spark`, { opacity: 1, y: -16, scale: 1 }, { opacity: 0, y: -34, scale: 0.4, duration: 0.6, stagger: 0.02, immediateRender: false }, '<')
  }
  const unpoint = () => { pointRef.current?.revert(); pointRef.current = null }

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

        <section className="stage"
          onMouseEnter={() => loopRef.current?.pause()} onMouseLeave={() => loopRef.current?.play()}>
          <CityHero />

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
                  : <button type="button" className="coin" key={i} aria-label={`Show source ${part.cite} on the map`}
                      onMouseEnter={() => point(part.cite)} onMouseLeave={unpoint}
                      onFocus={() => point(part.cite)} onBlur={unpoint}
                      onClick={() => point(part.cite)}>{part.cite}</button>)}
              </p>
              <div className="code">
                {CODE.map((l) => (
                  <div key={l.n} className={l.hl ? 'hl' : ''}><span className="ln">{l.n}</span>{l.text}</div>
                ))}
              </div>
            </div>
          </article>

          <ul className="legend">
            {DISTRICTS.map((l) => <li key={l.id}><i style={{ background: l.color }} />{l.label}</li>)}
            <li className="legend-hint">Hover a building to look around</li>
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
