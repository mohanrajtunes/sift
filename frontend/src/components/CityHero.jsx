import { useState } from 'react'

// HireLens drawn as a little riso-printed city.
// Each folder is a district, each file a building (taller = more lines).
// The agent is the gold express that hops roof to roof.

const W = 36, H = 21, X0 = 430, Y0 = 150
const iso = (gx, gy, z = 0) => [X0 + (gx - gy) * W, Y0 + (gx + gy) * H - z]
const NUGGET = [[-14, -4], [-6, -15], [8, -13], [16, -2], [11, 12], [-3, 15], [-15, 7]]
const NUG = (k, ox = 0, oy = 0) => NUGGET.map(([a, b]) => `${a * k + ox},${b * k + oy}`).join(' ')
const P = (...pts) => pts.map((p) => p.join(',')).join(' ')

export const DISTRICTS = [
  { id: 'accounts', label: 'backend/accounts', color: '#3255A4', box: [0, 0, 4.6, 3.6] },
  { id: 'ai', label: 'backend/ai', color: '#FF48B0', box: [6, 0, 4.6, 4.2] },
  { id: 'resumes', label: 'backend/resumes', color: '#FF7A3D', box: [0, 5, 4.6, 3.6] },
  { id: 'frontend', label: 'frontend', color: '#00A95C', box: [6, 5, 4.6, 3.6] },
]

const B = [
  ['a1', 'accounts', 'accounts/models.py', 41, 0.2, 0.2, 1.4, 1.4],
  ['a2', 'accounts', 'serializers.py', 58, 2.1, 0.2, 1.2, 1.2],
  ['a5', 'accounts', 'accounts/urls.py', 14, 3.6, 0.5, 0.8, 0.8],
  ['a3', 'accounts', 'accounts/views.py', 112, 0.2, 2, 1.6, 1.4],
  ['a4', 'accounts', 'tokens.py', 36, 2.4, 2.1, 1, 1],
  ['b1', 'ai', 'ai/urls.py', 9, 6.2, 0.2, 0.8, 0.8],
  ['b2', 'ai', 'ai/views.py', 96, 7.5, 0.3, 1.5, 1.5],
  ['b4', 'ai', 'ai/tests.py', 77, 9.3, 0.4, 1, 1.2],
  ['b3', 'ai', 'ai/services.py', 184, 6.5, 2.3, 1.8, 1.6],
  ['b5', 'ai', 'ai/prompts.py', 52, 9.1, 2.6, 1.2, 1.2],
  ['c1', 'resumes', 'resumes/pdf.py', 33, 0.3, 5.3, 1.2, 1.2],
  ['c2', 'resumes', 'resumes/views.py', 88, 2.2, 5.3, 1.6, 1.4],
  ['c3', 'resumes', 'resumes/models.py', 29, 0.7, 7.3, 1.2, 1],
  ['d1', 'frontend', 'lib/api.js', 61, 6.3, 5.3, 1, 1],
  ['d2', 'frontend', 'Match.jsx', 240, 7.9, 5.4, 1.6, 1.6],
  ['d3', 'frontend', 'Paper.jsx', 47, 6.5, 7.3, 1, 1],
  ['d4', 'frontend', 'Words.jsx', 31, 9.6, 7.5, 0.8, 0.8],
].map(([id, district, name, lines, gx, gy, w, d]) => {
  const h = Math.min(150, 20 + lines * 0.62)
  const col = DISTRICTS.find((x) => x.id === district).color
  const [rx, ry] = iso(gx + w / 2, gy + d / 2, h)
  return { id, district, name, lines, gx, gy, w, d, h, col, rx, ry }
}).sort((a, b) => (a.gx + a.w / 2 + a.gy + a.d / 2) - (b.gx + b.w / 2 + b.gy + b.d / 2))

export const BUILDINGS = Object.fromEntries(B.map((b) => [b.id, b]))

// the ride: drop onto resumes/pdf.py, hop to ai/views, then ai/services
const hop = (a, b, lift) => `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2},${Math.min(a[1], b[1]) - lift} ${b[0]},${b[1]}`
const roof = (id) => [BUILDINGS[id].rx, BUILDINGS[id].ry - 10]
export const HOPS = [
  `M${roof('c1')[0]},${roof('c1')[1] - 150} L${roof('c1')[0]},${roof('c1')[1]}`,
  hop(roof('c1'), roof('b2'), 140),
  hop(roof('b2'), roof('b3'), 60),
]
export const CITY_STOPS = [
  { n: 1, id: 'c1', tilt: -8 },
  { n: 2, id: 'b2', tilt: 6 },
  { n: 3, id: 'b3', tilt: -5 },
]

function windows(b) {
  const out = []
  const floors = Math.max(1, Math.floor((b.h - 10) / 13))
  const face = (len, at) => {
    const cols = Math.max(1, Math.round(len * 2))
    for (let f = 0; f < floors; f++) {
      const z0 = 7 + f * 13, z1 = z0 + 6
      for (let c = 0; c < cols; c++) {
        const u0 = (c + 0.28) / cols * len, u1 = (c + 0.72) / cols * len
        out.push(P(at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)))
      }
    }
  }
  face(b.w, (u, z) => iso(b.gx + u, b.gy + b.d, z))      // left front face
  face(b.d, (u, z) => iso(b.gx + b.w, b.gy + u, z))      // right front face
  return out
}

function Building({ b, onHover }) {
  const { gx, gy, w, d, h, col } = b
  const top = P(iso(gx, gy, h), iso(gx + w, gy, h), iso(gx + w, gy + d, h), iso(gx, gy + d, h))
  const left = P(iso(gx, gy + d), iso(gx + w, gy + d), iso(gx + w, gy + d, h), iso(gx, gy + d, h))
  const right = P(iso(gx + w, gy), iso(gx + w, gy + d), iso(gx + w, gy + d, h), iso(gx + w, gy, h))
  return (
    <g className={`bld bld-${b.id}`} onMouseEnter={() => onHover(b)} onMouseLeave={() => onHover(null)}>
      <g className="bld-in">
        <polygon points={left} fill={col} />
        <polygon points={right} fill={col} />
        <polygon points={right} fill="url(#city-ht)" />
        <polygon points={top} fill={col} />
        <polygon points={top} fill="#fff" opacity=".5" />
        <polygon className="roof-gold" points={top} fill="url(#gold)" opacity="0" />
        {windows(b).map((p, i) => <polygon key={i} className="win" points={p} />)}
        <path className="bld-edge" d={`M${iso(gx, gy + d, h)} L${iso(gx + w, gy + d, h)} L${iso(gx + w, gy, h)} M${iso(gx + w, gy + d)} L${iso(gx + w, gy + d, h)}`} />
        <polygon className="bld-out" points={P(iso(gx, gy + d), iso(gx + w, gy + d), iso(gx + w, gy), iso(gx + w, gy, h), iso(gx, gy, h), iso(gx, gy + d, h))} />
      </g>
    </g>
  )
}

export default function CityHero() {
  const [hover, setHover] = useState(null)
  return (
    <svg className="city" viewBox="0 0 860 660" role="img"
      aria-label="HireLens drawn as a small city: one district per folder, one building per file. The gold express hops from resumes/pdf.py to ai/views and lands on ai/services, where the answer is.">
      <defs>
        <radialGradient id="gold" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFF6C8" /><stop offset=".35" stopColor="#F7C93A" />
          <stop offset=".75" stopColor="#D4960F" /><stop offset="1" stopColor="#8A5800" />
        </radialGradient>
        <pattern id="city-ht" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.25" fill="#1D2A5C" opacity=".45" />
        </pattern>
        <pattern id="city-dots" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1" fill="#1D2A5C" opacity=".22" />
        </pattern>
      </defs>

      {/* streets and district plates, printed flat on the paper */}
      <g className="city-ground">
        <polygon className="city-base" points={P(iso(-0.6, -0.6), iso(11.2, -0.6), iso(11.2, 9.2), iso(-0.6, 9.2))} />
        {DISTRICTS.map((t) => {
          const [x, y, w, d] = t.box
          const [lx, ly] = iso(x + 0.15, y + d - 0.15)
          return (
            <g key={t.id} className={`district district-${t.id}`}>
              <polygon points={P(iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d))} fill={t.color} opacity=".16" />
              <polygon points={P(iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d))} fill="url(#city-dots)" />
              <text className="district-label" transform={`matrix(.87 .49 -.87 .49 ${lx} ${ly}) translate(0 -4)`}>{t.label}</text>
            </g>
          )
        })}
        <path className="city-road" d={`M${iso(5.3, -0.6)} L${iso(5.3, 9.2)} M${iso(-0.6, 4.6)} L${iso(11.2, 4.6)}`} />
      </g>

      {B.map((b) => <Building key={b.id} b={b} onHover={setHover} />)}

      {/* the trail the express leaves */}
      {HOPS.map((d, i) => (
        <g key={i}>
          <path id={`hop-${i}`} d={d} fill="none" stroke="none" />
          {i > 0 && <path className={`city-trail city-trail-${i}`} d={d} />}
        </g>
      ))}

      {CITY_STOPS.map((s) => {
        const b = BUILDINGS[s.id]
        return (
          <g key={s.n}>
            <g className={`cstamp stamp-${s.n}`} transform={`translate(${b.rx - 26} ${b.ry - 38})`}>
              <g className="stamp-in" transform={`rotate(${s.tilt})`}>
                <circle r="13" /><text y="6">{s.n}</text>
              </g>
            </g>
            <g transform={`translate(${b.rx + 8} ${b.ry - 40})`}>
              <g className={`blabel blabel-${s.id}`}>
                <rect x="0" y="-15" width={b.name.length * 7.3 + 16} height="22" rx="11" />
                <text x="8" y="0">{b.name}</text>
              </g>
            </g>
          </g>
        )
      })}

      <g className="sparks-city">
        {['b2', 'b3'].map((id) => (
          <g key={id} className={`spk spk-${id}`} transform={`translate(${BUILDINGS[id].rx} ${BUILDINGS[id].ry})`}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path key={a} className="spark" d="M0,-5 L1.5,0 L0,5 L-1.5,0 Z" fill="#F2B925" transform={`rotate(${a}) translate(0 -22)`} opacity="0" />
            ))}
          </g>
        ))}
      </g>

      <g className="train">
        <g className="train-pop">
          <g className="train-body">
            <rect x="-20" y="-10" width="40" height="20" rx="10" fill="url(#gold)" stroke="#8A5800" strokeWidth="1.6" />
            <rect x="6" y="-5" width="9" height="10" rx="3" fill="#1D2A5C" />
            <rect x="-14" y="-5" width="9" height="10" rx="3" fill="#1D2A5C" opacity=".85" />
          </g>
        </g>
      </g>

      {hover && (
        <g className="tip" transform={`translate(${hover.rx} ${hover.ry - 16})`} pointerEvents="none">
          <rect x={-Math.max(60, hover.name.length * 4.2)} y="-44" width={Math.max(120, hover.name.length * 8.4)} height="40" rx="12" />
          <text y="-28">{hover.name}</text>
          <text y="-12" className="tip-sub">{hover.lines} lines</text>
        </g>
      )}
    </svg>
  )
}
