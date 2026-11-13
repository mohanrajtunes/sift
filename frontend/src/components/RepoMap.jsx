import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { layoutMetro, WIDTH } from '../lib/metro.js'

gsap.registerPlugin(useGSAP, DrawSVGPlugin)

const NUG = [[-12, -3], [-5, -13], [7, -11], [14, -2], [10, 10], [-3, 13], [-13, 6]].map((p) => p.join(',')).join(' ')

// visited: files the agent looked at; cited: files in the answer; at: where the train is
export default function RepoMap({ graph, visited = [], cited = [], at = null, focus = null, onPick }) {
  const root = useRef(null)
  const [hoverRaw, setHover] = useState(null)
  const hover = hoverRaw || focus
  const map = useMemo(() => layoutMetro(graph), [graph])
  const ids = Object.keys(map.stations).join('|')
  const train = at && map.stations[at]

  // new lines and stations print in as they appear (also while indexing)
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.rm-line:not(.seen)', { drawSVG: '0%', duration: 0.9, stagger: 0.08, ease: 'power2.inOut' })
      gsap.from('.rm-st:not(.seen)', { scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.012, ease: 'back.out(3)' })
      root.current?.querySelectorAll('.rm-line, .rm-st').forEach((e) => e.classList.add('seen'))
    })
  }, { scope: root, dependencies: [ids] })

  // the train glides to wherever the agent is looking
  useGSAP(() => {
    if (!train) return
    gsap.to('.rm-train', { x: train.x, y: train.y - 22, duration: 0.8, ease: 'power2.inOut', autoAlpha: 1 })
  }, { scope: root, dependencies: [train?.id] })

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
    <div ref={root} className="rm">
      <svg viewBox={`0 0 ${WIDTH} ${map.height}`} role="img" aria-label={`Map of ${graph.nodes.length} files, one line per folder`}>
        <defs>
          <radialGradient id="rm-gold" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#FFF6C8" /><stop offset=".4" stopColor="#F7C93A" />
            <stop offset=".8" stopColor="#D4960F" /><stop offset="1" stopColor="#8A5800" />
          </radialGradient>
        </defs>

        {map.links.map((l) => (
          <path key={l.source + l.target} className={`rm-link${lit && lit.has(l.source) && lit.has(l.target) ? ' on' : ''}`} d={l.d} />
        ))}

        {map.lines.map((l) => (
          <g key={l.folder}>
            <path className="rm-line" d={l.d} stroke={l.color} strokeWidth="12" opacity=".28" transform="translate(2.5 2)" />
            <path className="rm-line main" d={l.d} stroke={l.color} strokeWidth="10" />
            <text className="rm-folder" x={l.labelX} y={l.labelY}>
              {l.folder}{l.hidden > 0 ? `  +${l.hidden} more` : ''}
            </text>
          </g>
        ))}

        {Object.values(map.stations).map((s) => {
          const isCited = cited.includes(s.id)
          const state = isCited ? ' cited' : visited.includes(s.id) ? ' visited' : ''
          const dim = lit && !lit.has(s.id) && hover !== s.id
          return (
            <g key={s.id} data-id={s.id} className={`rm-st${state}${dim ? ' dim' : ''}`} tabIndex="0" role="button"
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

        <g className="rm-train" style={{ visibility: 'hidden' }}>
          <rect x="-16" y="-8" width="32" height="16" rx="8" fill="#1D2A5C" />
          <rect x="5" y="-4" width="7" height="8" rx="2" fill="#FFE24A" />
          <path d="M0,8 L0,14" stroke="#1D2A5C" strokeWidth="2" />
        </g>

        {hover && map.stations[hover] && (
          <g className="tip" transform={`translate(${map.stations[hover].x} ${map.stations[hover].y - 26})`} pointerEvents="none">
            <rect x={-Math.max(50, hover.length * 3.4)} y="-30" width={Math.max(100, hover.length * 6.8)} height="24" rx="12" />
            <text y="-13">{hover}</text>
          </g>
        )}
      </svg>
      {map.hiddenFolders > 0 && <p className="rm-more">{map.hiddenFolders} smaller folders are not drawn.</p>}
    </div>
  )
}
