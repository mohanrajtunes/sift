import { useState } from 'react'
import { LINES, ROUTE, STOPS } from '../data/demoMap.js'

// A gold nugget: an uneven polygon with a highlight, plus a halftone shadow.
const NUGGET = [[-14, -4], [-6, -15], [8, -13], [16, -2], [11, 12], [-3, 15], [-15, 7]]
const pts = (s, ox = 0, oy = 0) => NUGGET.map(([a, b]) => `${a * s + ox},${b * s + oy}`).join(' ')

function Nugget({ id, x, y, size }) {
  return (
    <g className={`nug nug-${id}`} transform={`translate(${x} ${y})`}>
      <g className="nug-body">
        <polygon points={pts(size, 4, 5)} fill="url(#ht)" />
        <polygon points={pts(size)} fill="url(#gold)" stroke="#8A5800" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={`M${-6 * size},${-8 * size} l5,-3`} stroke="#FFFBE6" strokeWidth="2.4" strokeLinecap="round" />
        <rect className="glint" x={-30} y={-24} width="7" height="48" fill="#FFFBE6" opacity="0"
          transform="rotate(25)" clipPath={`url(#clip-${id})`} />
        <clipPath id={`clip-${id}`}><polygon points={pts(size)} /></clipPath>
      </g>
      <g className="sparks">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} className="spark" d="M0,-4 L1.2,0 L0,4 L-1.2,0 Z" fill="#F2B925"
            transform={`rotate(${a}) translate(0 -18)`} opacity="0" />
        ))}
      </g>
    </g>
  )
}

function labelProps(st, cited) {
  switch (st.label) {
    case 'above': return { x: st.x, y: st.y - 20, textAnchor: 'middle' }
    case 'left': return { x: st.x - 18, y: st.y + 5, textAnchor: 'end' }
    case 'right': return { x: st.x + 16, y: st.y + 5, textAnchor: 'start' }
    default: return { x: st.x, y: st.y + (cited ? 34 : 30), textAnchor: 'middle' }
  }
}

function Note({ x, y, tilt, lines, pink, className }) {
  return (
    <g className={`note ${className}`} transform={`rotate(${tilt} ${x} ${y})`}>
      <text x={x} y={y} className={pink ? 'note-text pink' : 'note-text'}>
        {lines.map((l, i) => <tspan key={l} x={x} dy={i ? 26 : 0}>{l}</tspan>)}
      </text>
    </g>
  )
}

export default function MetroMap() {
  const [hover, setHover] = useState(null)

  return (
    <svg className="metro" viewBox="560 110 860 660" role="img"
      aria-label="HireLens drawn as a metro map. The agent rides from resumes/pdf.py to ai/views and stops at ai/services, where the answer is.">
      <defs>
        <radialGradient id="gold" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFF6C8" />
          <stop offset=".35" stopColor="#F7C93A" />
          <stop offset=".75" stopColor="#D4960F" />
          <stop offset="1" stopColor="#8A5800" />
        </radialGradient>
        <pattern id="ht" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill="#FFE24A" />
        </pattern>
        <mask id="trail-mask" maskUnits="userSpaceOnUse">
          <path className="trail-reveal" d={ROUTE} fill="none" stroke="#fff" strokeWidth="14" />
        </mask>
      </defs>

      {/* each line is printed twice, a little off, like riso ink */}
      {LINES.map((l) => (
        <g key={l.id} className={`line line-${l.id}`}>
          <path className="line-path" d={l.d} stroke={l.raw} strokeWidth="13" opacity=".28" transform="translate(2.5 2)" />
          <path className="line-path main" d={l.d} stroke={l.raw} strokeWidth="11" />
        </g>
      ))}

      {/* the trail the agent leaves, revealed as the train moves */}
      <path className="trail" d={ROUTE} mask="url(#trail-mask)" transform="translate(-15 -15)" />
      <path className="route" d={ROUTE} fill="none" stroke="none" />

      {LINES.map((l) => l.stations.map((st) => (
        <g key={st.name} className={`st${st.cited ? ' cited' : ''}`}
          onMouseEnter={() => setHover(st)} onMouseLeave={() => setHover(null)}>
          <g className="st-pop">
            <circle className={`st-dot st-dot-${st.name.replace(/[^a-z]/gi, '')}`} cx={st.x} cy={st.y} r="9" />
          </g>
          <text className={`st-label${st.cited ? ' strong' : ''}`} {...labelProps(st, st.cited)}>{st.name}</text>
        </g>
      )))}

      <Nugget id="views" x={830} y={390} size={1.05} />
      <Nugget id="services" x={970} y={390} size={1.35} />

      {STOPS.map((s) => (
        <g key={s.n} className={`stamp stamp-${s.n}`} transform={`translate(${s.x + s.dx} ${s.y + s.dy})`}>
          <g className="stamp-in" transform={`rotate(${s.tilt})`}>
            <circle r="13" />
            <text y="6">{s.n}</text>
          </g>
        </g>
      ))}

      <g className="train">
        <g className="train-pop">
        <g className="train-body">
          <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#1D2A5C" />
          <rect x="6" y="-5" width="9" height="10" rx="3" fill="#FFE24A" />
          <circle cx="-9" cy="0" r="2.2" fill="#ECEDE6" opacity=".7" />
        </g>
        </g>
      </g>

      <Note className="n1" x={572} y={466} tilt={-5} lines={['it starts', 'here']} />
      <path className="arrow n1a" d="M606,506 C608,524 616,538 628,548 M628,548 l-9,-1 M628,548 l0,-9" />
      <Note className="n2" x={1150} y={262} tilt={3} pink lines={['the proof is', 'in here!']} />
      <path className="arrow pink n2a" d="M1160,292 C1100,300 1030,330 990,368 M990,368 l2,-10 M990,368 l10,-2" />
      <Note className="n3" x={995} y={466} tilt={4} lines={['the train is', 'the agent']} />
      <path className="arrow n3a" d="M1010,450 C1004,436 998,424 994,414 M994,414 l-5,8 M994,414 l7,6" />
      <Note className="n4" x={1250} y={446} tilt={-3} lines={['one line per', 'folder']} />

      {hover && (
        <g className="tip" transform={`translate(${hover.x} ${hover.y - 30})`} pointerEvents="none">
          <rect x="-46" y="-30" width="92" height="26" rx="13" />
          <text y="-12">{hover.lines} lines</text>
        </g>
      )}
    </svg>
  )
}
