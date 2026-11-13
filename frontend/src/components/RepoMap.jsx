import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { layoutMetro, WIDTH } from '../lib/metro.js'

gsap.registerPlugin(useGSAP, DrawSVGPlugin, MotionPathPlugin)

const seenTour = () => { try { return localStorage.getItem('sift:tour') === '1' } catch { return false } }

const NUG = [[-12, -3], [-5, -13], [7, -11], [14, -2], [10, 10], [-3, 13], [-13, 6]].map((p) => p.join(',')).join(' ')

// visited: files the agent looked at; cited: files in the answer; at: where the train is
export default function RepoMap({ graph, visited = [], cited = [], route = [], busy = false, focus = null, onPick }) {
  const root = useRef(null)
  const [hoverRaw, setHover] = useState(null)
  const hover = hoverRaw || focus
  const map = useMemo(() => layoutMetro(graph), [graph])
  const ids = Object.keys(map.stations).join('|')
  const [tour, setTour] = useState(false)
  const tl = useRef(null)

  // pick a line, a stop and an import link to explain
  const T = useMemo(() => {
    const L = map.lines[1] || map.lines[0]
    if (!L) return null
    const S = Object.values(map.stations).filter((s) => s.folder === L.folder).sort((a, b) => a.x - b.x)
    if (!S.length) return null
    const ids = new Set(S.map((s) => s.id))
    const link = map.links.find((l) => ids.has(l.source) || ids.has(l.target)) || map.links[0]
    return { L, S, s0: S[Math.min(1, S.length - 1)], link }
  }, [map])

  // first visit: play the tour once the map has printed in
  useEffect(() => {
    if (!T || seenTour() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setTimeout(() => setTour(true), 1800)
    return () => clearTimeout(id)
  }, [T])

  const endTour = () => {
    tl.current?.kill()
    gsap.set(root.current.querySelectorAll('.rm-dim, .rm-link'), { clearProps: 'opacity,strokeWidth' })
    try { localStorage.setItem('sift:tour', '1') } catch { /* private mode */ }
    setTour(false)
  }

  useGSAP(() => {
    if (!tour || !T) return
    const q = (sel) => root.current.querySelectorAll(sel)
    const lineEl = q(`[data-folder="${CSS.escape(T.L.folder)}"]`)
    const st0 = q(`[data-id="${CSS.escape(T.s0.id)}"]`)
    const t = gsap.timeline({ onComplete: endTour })
    tl.current = t
    gsap.set('.tour > g', { autoAlpha: 0 })

    // 1. a line is a folder
    t.to(q('.rm-dim'), { opacity: 0.12, duration: 0.5 })
      .to(lineEl, { opacity: 1, duration: 0.5 }, '<')
      .set('.t1', { autoAlpha: 1 })
      .from('.t1 path', { drawSVG: '0%', duration: 0.6, ease: 'power2.out' })
      .from('.t1 text', { autoAlpha: 0, x: -10, duration: 0.35 }, '-=0.2')
      .to({}, { duration: 1.8 })
      .to('.t1', { autoAlpha: 0, duration: 0.25 })
    // 2. a stop is a file
      .to(lineEl, { opacity: 0.35, duration: 0.3 })
      .to(st0, { opacity: 1, duration: 0.3 }, '<')
      .set('.t2', { autoAlpha: 1 })
      .fromTo('.t2 circle', { scale: 0.4, autoAlpha: 1, transformOrigin: '50% 50%' }, { scale: 1.6, autoAlpha: 0, duration: 0.9, repeat: 2, ease: 'power1.out' })
      .from('.t2 text', { autoAlpha: 0, y: 8, duration: 0.35 }, '<0.2')
      .to({}, { duration: 0.9 })
      .to('.t2', { autoAlpha: 0, duration: 0.25 })
    // 3. dashed = imports
    if (T.link) {
      const ends = q(`[data-id="${CSS.escape(T.link.source)}"], [data-id="${CSS.escape(T.link.target)}"]`)
      const linkEl = q(`.rm-link[data-k="${CSS.escape(T.link.source + T.link.target)}"]`)
      const path = linkEl[0]
      if (path) {
        const m = path.getPointAtLength(path.getTotalLength() / 2)
        gsap.set('.t3', { x: m.x, y: m.y })
      }
      t.to(st0, { opacity: 0.12, duration: 0.3 })
        .to(lineEl, { opacity: 0.12, duration: 0.3 }, '<')
        .to(ends, { opacity: 1, duration: 0.3 }, '<')
        .to(linkEl, { opacity: 1, strokeWidth: 2.6, duration: 0.3 }, '<')
        .set('.t3', { autoAlpha: 1 })
        .from('.t3 text', { autoAlpha: 0, y: 8, duration: 0.35 })
        .to({}, { duration: 2 })
        .to('.t3', { autoAlpha: 0, duration: 0.25 })
        .to(linkEl, { opacity: 0.18, strokeWidth: 1.2, duration: 0.3 }, '<')
    }
    // 4. the train shows what Sift reads
    t.to(q('.rm-dim'), { opacity: 1, duration: 0.4 })
      .set('.t4', { autoAlpha: 1 })
      .from('.t4 text', { autoAlpha: 0, y: 8, duration: 0.35 })
      .fromTo('.t4-train', { autoAlpha: 1 }, {
        duration: 2.6, ease: 'power1.inOut',
        motionPath: { path: '#tour-path', align: '#tour-path', alignOrigin: [0.5, 0.5] },
      }, '<')
      .to({}, { duration: 0.6 })
      .to('.t4', { autoAlpha: 0, duration: 0.3 })
  }, { scope: root, dependencies: [tour] })

  const city = useRef([])
  const live = useRef(busy)
  live.current = busy

  // power on: lines draw, stops light up left to right, then a small train starts on every line
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const xd = (i, el) => 0.5 + (+el.getAttribute('cx') || 0) / WIDTH * 1.1
      gsap.from('.rm-line:not(.seen)', { drawSVG: '0%', duration: 0.9, stagger: 0.08, ease: 'power2.inOut' })
      gsap.from('.rm-st:not(.seen) circle', { attr: { r: 0 }, duration: 0.45, delay: xd, ease: 'back.out(3)' })
      gsap.to('.rm-st:not(.seen) circle', {
        keyframes: [{ fill: '#FFE24A', duration: 0.12 }, { fill: '#ffffff', duration: 0.5 }],
        delay: (i, el) => xd(i, el) + 0.25, clearProps: 'fill',
      })
      root.current?.querySelectorAll('.rm-line, .rm-st').forEach((e) => e.classList.add('seen'))

      // the city: one shuttle per line, stops blink as it passes
      city.current.forEach((t) => t.kill())
      city.current = map.lines.map((l, i) => {
        const stops = [...root.current.querySelectorAll(`[data-folder-st="${CSS.escape(l.folder)}"]`)]
        const last = new Map()
        const el = root.current.querySelector(`#ct-${i}`)
        const len = Math.abs(stops.length ? +stops[stops.length - 1].dataset.x - +stops[0].dataset.x : 300)
        return gsap.fromTo(el, { autoAlpha: 0 }, {
          autoAlpha: 1, duration: 5 + len / 110, ease: 'none', repeat: -1, yoyo: true, delay: 2 + i * 0.45,
          motionPath: { path: `#rl-${i}`, align: `#rl-${i}`, alignOrigin: [0.5, 0.5], autoRotate: true },
          onUpdate() {
            const x = gsap.getProperty(el, 'x')
            const now = performance.now()
            stops.forEach((st) => {
              if (Math.abs(+st.dataset.x - x) < 7 && now - (last.get(st) || 0) > 700) {
                last.set(st, now)
                st.classList.add('blink')
                setTimeout(() => st.classList.remove('blink'), 380)
              }
            })
          },
        })
      })
      if (live.current) city.current.forEach((t) => t.timeScale(0))
      return () => city.current.forEach((t) => t.kill())
    })
  }, { scope: root, dependencies: [ids] })

  // while Sift answers the city holds and goes dark; the express gets the tracks
  useEffect(() => {
    if (!city.current.length) return
    gsap.to(city.current, { timeScale: busy ? 0 : 1, duration: busy ? 0.6 : 1.2, ease: 'power2.inOut', overwrite: true })
  }, [busy])

  // the express: hops along the agent's route, leaving a gold trail
  const exp = useRef({ tl: null, done: 0 })
  const segs = useMemo(() => {
    const pts = route.map((id) => map.stations[id]).filter(Boolean)
    return pts.map((b, i) => {
      const a = pts[i - 1] || { x: b.x - 140, y: b.y }
      const lift = Math.min(70, 24 + Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
      return { id: b.id, x: b.x, y: b.y, first: i === 0, d: `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - lift} ${b.x},${b.y}` }
    })
  }, [route, map])

  useGSAP(() => {
    const e = exp.current
    if (!segs.length) { e.tl?.kill(); e.tl = null; e.done = 0; gsap.set('.rm-train', { autoAlpha: 0 }); return }
    if (segs.length < e.done) e.done = 0
    if (!e.tl || e.done === 0) { e.tl?.kill(); e.tl = gsap.timeline() }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    segs.slice(e.done).forEach((s, k) => {
      const i = e.done + k
      const sel = `.rm-trail[data-i="${i}"]`
      if (reduce) { e.tl.set('.rm-train', { x: s.x, y: s.y, autoAlpha: 1 }).set(sel, { autoAlpha: 1 }); return }
      e.tl.set(sel, { autoAlpha: 1, drawSVG: '0%' })
        .to('.rm-train', {
          autoAlpha: 1, duration: s.first ? 0.7 : 0.9, ease: 'power2.inOut',
          motionPath: { path: s.d, autoRotate: false },
        }, '>')
        .to(sel, { drawSVG: '100%', duration: s.first ? 0.7 : 0.9, ease: 'power2.inOut' }, '<')
        .set('.rm-ripple', { attr: { cx: s.x, cy: s.y } })
        .fromTo('.rm-ripple', { scale: 0.6, autoAlpha: 0.9, transformOrigin: '50% 50%' }, { scale: 3, autoAlpha: 0, duration: 0.6, ease: 'power2.out' })
        .fromTo('.rm-train-body', { scaleX: 1.25, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 0.45, ease: 'elastic.out(1,0.4)' }, '<')
    })
    e.done = segs.length
  }, { scope: root, dependencies: [segs.map((s) => s.id).join('|')] })

  useGSAP(() => {
    if (!cited.length) return
    gsap.from('.rm-nug.new', { scale: 0, rotation: -50, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(3.5)', stagger: 0.12 })
  }, { scope: root, dependencies: [cited.join('|')] })

  useEffect(() => {
    if (!focus) return
    const el = root.current?.querySelector(`[data-id="${CSS.escape(focus)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    if (el && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(el, { scale: 1 }, { scale: 1.5, transformOrigin: '50% 50%', duration: 0.25, yoyo: true, repeat: 3 })
    }
  }, [focus])

  const lit = hover ? new Set(map.links.filter((l) => l.source === hover || l.target === hover).flatMap((l) => [l.source, l.target])) : null

  if (!graph.nodes.length) return <div ref={root} className="rm-empty">No files yet. They appear here as they're indexed.</div>

  return (
    <div ref={root} className={`rm${busy ? ' live' : ''}`}>
      <svg viewBox={`0 0 ${WIDTH} ${map.height}`} role="img" aria-label={`Map of ${graph.nodes.length} files, one line per folder`}>
        <defs>
          <radialGradient id="rm-gold" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#FFF6C8" /><stop offset=".4" stopColor="#F7C93A" />
            <stop offset=".8" stopColor="#D4960F" /><stop offset="1" stopColor="#8A5800" />
          </radialGradient>
        </defs>

        {map.links.map((l) => (
          <path key={l.source + l.target} data-k={l.source + l.target} className={`rm-link${lit && lit.has(l.source) && lit.has(l.target) ? ' on' : ''}`} d={l.d} />
        ))}

        {map.lines.map((l, i) => (
          <g key={l.folder} className="rm-dim" data-folder={l.folder}>
            <path className="rm-line" d={l.d} stroke={l.color} strokeWidth="12" opacity=".28" transform="translate(2.5 2)" />
            <path className="rm-line main" id={`rl-${i}`} d={l.d} stroke={l.color} strokeWidth="10" />
            <text className="rm-folder" x={l.labelX} y={l.labelY}>
              {l.folder === '.' ? 'root folder' : l.folder}{l.hidden > 0 ? `  +${l.hidden} more` : ''}
            </text>
          </g>
        ))}

        {Object.values(map.stations).map((s) => {
          const isCited = cited.includes(s.id)
          const state = isCited ? ' cited' : visited.includes(s.id) ? ' visited' : ''
          const dim = lit && !lit.has(s.id) && hover !== s.id
          return (
            <g key={s.id} data-id={s.id} data-folder-st={s.folder} data-x={s.x} style={{ '--c': s.color }} className={`rm-st rm-dim${state}${dim ? ' dim' : ''}`} tabIndex="0" role="button"
              aria-label={`${s.id}, ${s.lines} lines`}
              onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.id)} onBlur={() => setHover(null)}
              onClick={() => onPick?.(s.id)} onKeyDown={(e) => e.key === 'Enter' && onPick?.(s.id)}>
              {isCited
                ? <polygon className="rm-nug new" points={NUG} transform={`translate(${s.x} ${s.y})`} fill="url(#rm-gold)" stroke="#8A5800" strokeWidth="1.5" />
                : <circle cx={s.x} cy={s.y} r="8.5" />}
              <text x={s.x} y={s.above ? s.y - 17 : s.y + 27}>{s.name}</text>
            </g>
          )
        })}

        <g className="rm-city" aria-hidden="true">
          {map.lines.map((l, i) => (
            <g key={l.folder} id={`ct-${i}`} className="rm-shuttle" style={{ visibility: 'hidden' }}>
              <rect x="-9" y="-4.5" width="18" height="9" rx="4.5" fill="#1D2A5C" stroke="#fff" strokeWidth="1.5" />
            </g>
          ))}
        </g>

        {segs.map((s, i) => (
          <g key={i}>
            <path className="rm-trail rm-trail-under" d={s.d} />
            <path className="rm-trail" data-i={i} d={s.d} style={{ visibility: 'hidden' }} />
          </g>
        ))}
        <circle className="rm-ripple" r="12" style={{ visibility: 'hidden' }} />

        <g className="rm-train" style={{ visibility: 'hidden' }}>
          <g className="rm-train-body">
            <rect x="-19" y="-10" width="38" height="20" rx="10" fill="url(#rm-gold)" stroke="#8A5800" strokeWidth="1.5" />
            <rect x="5" y="-5" width="8" height="10" rx="2.5" fill="#1D2A5C" />
            <rect x="-11" y="-5" width="8" height="10" rx="2.5" fill="#1D2A5C" opacity=".85" />
          </g>
        </g>

        {tour && T && (
          <g className="tour" pointerEvents="none">
            <path id="tour-path" d={T.L.d} fill="none" stroke="none" />
            <g className="t1">
              <path d={`M${T.L.labelX - 4},${T.L.labelY + 7} q${T.L.folder.length * 4},6 ${T.L.folder.length * 8.4},-1`} />
              <text x={T.L.labelX + T.L.folder.length * 8.4 + 18} y={T.L.labelY + 3}>← each coloured line is a folder</text>
            </g>
            <g className="t2">
              <circle cx={T.s0.x} cy={T.s0.y} r="15" />
              <text x={T.s0.x + 22} y={T.s0.y + 52}>each stop is a file. click one to ask about it</text>
            </g>
            <g className="t3"><text x="12" y="-14">dotted = one file imports the other</text></g>
            <g className="t4">
              <text x={T.S[0].x} y={T.S[0].y + 56}>ask something and this train shows what Sift reads</text>
              <g className="t4-train">
                <rect x="-16" y="-8" width="32" height="16" rx="8" fill="#1D2A5C" />
                <rect x="5" y="-4" width="7" height="8" rx="2" fill="#FFE24A" />
              </g>
            </g>
          </g>
        )}

        {hover && map.stations[hover] && (
          <g className="tip" transform={`translate(${map.stations[hover].x} ${map.stations[hover].y - 26})`} pointerEvents="none">
            <rect x={-Math.max(50, hover.length * 3.4)} y="-30" width={Math.max(100, hover.length * 6.8)} height="24" rx="12" />
            <text y="-13">{hover}</text>
          </g>
        )}
      </svg>
      {tour
        ? <button className="tour-btn" onClick={endTour}>Skip the tour</button>
        : <button className="tour-btn" onClick={() => setTour(true)}>How do I read this map?</button>}
      {map.hiddenFolders > 0 && <p className="rm-more">{map.hiddenFolders} smaller folders are not drawn.</p>}
    </div>
  )
}
