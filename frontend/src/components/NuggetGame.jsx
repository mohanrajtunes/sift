import { useEffect, useRef, useState } from 'react'

// Catch the nugget: slide the sieve, catch gold (cited code), dodge junk (node_modules and friends).
const W = 300, H = 260, SIEVE = 70, ROUND = 20
const JUNK = ['node_modules', '.DS_Store', 'dist/', 'package-lock', '.env?!', 'TODO']

export default function NuggetGame() {
  const [state, setState] = useState('idle') // idle | play | over
  const [score, setScore] = useState(0)
  const [time, setTime] = useState(ROUND)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('sift:best') || 0) } catch { return 0 } })
  const [items, setItems] = useState([])
  const [x, setX] = useState(W / 2 - SIEVE / 2)
  const box = useRef(null)
  const g = useRef({})

  useEffect(() => {
    if (state !== 'play') return
    const s = g.current = { items: [], score: 0, x: W / 2 - SIEVE / 2, last: performance.now(), spawn: 0, left: ROUND, keys: {} }
    let raf
    const tick = (now) => {
      const dt = Math.min(0.05, (now - s.last) / 1000); s.last = now
      s.left -= dt
      if (s.keys.ArrowLeft) s.x -= 320 * dt
      if (s.keys.ArrowRight) s.x += 320 * dt
      s.x = Math.max(0, Math.min(W - SIEVE, s.x))
      s.spawn -= dt
      if (s.spawn <= 0) {
        const junk = Math.random() < 0.35
        s.items.push({ id: now, x: 10 + Math.random() * (W - 40), y: -24, v: 90 + Math.random() * 80 + (ROUND - s.left) * 6, junk, label: JUNK[Math.floor(Math.random() * JUNK.length)] })
        s.spawn = 0.55 - (ROUND - s.left) * 0.012
      }
      s.items = s.items.filter((it) => {
        it.y += it.v * dt
        const hit = it.y > H - 46 && it.y < H - 20 && it.x + 18 > s.x && it.x < s.x + SIEVE
        if (hit) { s.score += it.junk ? -2 : 1; s.flash = it.junk ? 'bad' : 'good'; s.flashAt = now; return false }
        return it.y < H
      })
      setItems([...s.items]); setScore(s.score); setX(s.x); setTime(Math.max(0, Math.ceil(s.left)))
      if (s.left <= 0) {
        setState('over')
        setBest((b) => { const n = Math.max(b, s.score); try { localStorage.setItem('sift:best', n) } catch { /* fine */ } return n })
        return
      }
      raf = requestAnimationFrame(tick)
    }
    const down = (e) => { if (e.key in { ArrowLeft: 1, ArrowRight: 1 }) { s.keys[e.key] = true; e.preventDefault() } }
    const up = (e) => { s.keys[e.key] = false }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [state])

  const move = (e) => {
    if (state !== 'play') return
    const r = box.current.getBoundingClientRect()
    g.current.x = Math.max(0, Math.min(W - SIEVE, (e.clientX - r.left) * (W / r.width) - SIEVE / 2))
  }
  const flash = g.current.flash && performance.now() - g.current.flashAt < 250 ? g.current.flash : ''

  return (
    <div className="game">
      <div className="game-hd"><span>Score {score}</span><span>{state === 'play' ? `${time}s` : `Best ${best}`}</span></div>
      <div className={`game-box ${flash}`} ref={box} onPointerMove={move} style={{ aspectRatio: `${W} / ${H}` }}>
        {items.map((it) => (
          <span key={it.id} className={it.junk ? 'g-junk' : 'g-gold'} style={{ left: `${(it.x / W) * 100}%`, top: `${(it.y / H) * 100}%` }}>
            {it.junk ? it.label : ''}
          </span>
        ))}
        <span className="g-sieve" style={{ left: `${(x / W) * 100}%`, width: `${(SIEVE / W) * 100}%` }} />
        {state !== 'play' && (
          <div className="game-cover">
            <p>{state === 'over' ? `You sifted ${score} nugget${score === 1 ? '' : 's'}!` : 'Catch the gold. Dodge the junk.'}</p>
            <button onClick={() => { setItems([]); setScore(0); setTime(ROUND); setState('play') }}>{state === 'over' ? 'Again' : 'Play'}</button>
            <small>Mouse or arrow keys, 20 seconds</small>
          </div>
        )}
      </div>
    </div>
  )
}
