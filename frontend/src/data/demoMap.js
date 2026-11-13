// The home page demo: HireLens drawn as a metro map.
// One line per folder, one station per file. Coordinates are in the SVG's own units.

export const LINES = [
  {
    id: 'accounts', label: 'accounts', color: 'var(--blue)', raw: '#3255A4',
    d: 'M640,170 H900 L960,230 H1330',
    stations: [
      { name: 'accounts/models', x: 700, y: 170, lines: 41, label: 'above' },
      { name: 'serializers', x: 830, y: 170, lines: 58, label: 'above' },
      { name: 'accounts/views', x: 960, y: 230, lines: 112, label: 'below' },
      { name: 'tokens.py', x: 1150, y: 230, lines: 36, label: 'above' },
      { name: 'urls', x: 1290, y: 230, lines: 14, label: 'above' },
    ],
  },
  {
    id: 'ai', label: 'backend/ai', color: 'var(--pink)', raw: '#FF48B0',
    d: 'M600,330 H770 L830,390 H1090 L1150,330 H1330',
    stations: [
      { name: 'ai/urls', x: 640, y: 330, lines: 9, label: 'above' },
      { name: 'ai/views', x: 830, y: 390, lines: 96, label: 'left', cited: true },
      { name: 'ai/services', x: 970, y: 390, lines: 184, cited: true },
      { name: 'ai/tests', x: 1090, y: 390, lines: 77 },
      { name: 'ai/prompts', x: 1240, y: 330, lines: 52, label: 'above' },
    ],
  },
  {
    id: 'resumes', label: 'resumes', color: 'var(--orange)', raw: '#FF7A3D',
    d: 'M600,560 H770 L830,500 V390',
    stations: [
      { name: 'resumes/pdf.py', x: 640, y: 560, lines: 33 },
      { name: 'resumes/views', x: 770, y: 560, lines: 88 },
      { name: 'resumes/models', x: 830, y: 470, lines: 29, label: 'right' },
    ],
  },
  {
    id: 'frontend', label: 'frontend', color: 'var(--green)', raw: '#00A95C',
    d: 'M1140,740 V610 L1200,550 H1345 L1395,500',
    stations: [
      { name: 'lib/api.js', x: 1140, y: 690, lines: 61, label: 'right' },
      { name: 'Match.jsx', x: 1200, y: 550, lines: 240, label: 'above' },
      { name: 'Paper.jsx', x: 1272, y: 550, lines: 47, label: 'above' },
      { name: 'Words.jsx', x: 1340, y: 550, lines: 31, label: 'above' },
    ],
  },
]

// The agent's ride for the demo question, and where it stops.
export const ROUTE = 'M640,560 H770 L830,500 V390 H970'
export const STOPS = [
  { n: 1, at: 0, x: 640, y: 560, dx: -4, dy: -34, tilt: -8, what: 'Searched the code' },
  { n: 2, at: 0.699, x: 830, y: 390, dx: -40, dy: -26, tilt: 6, what: 'Opened ai/views' },
  { n: 3, at: 1, x: 970, y: 390, dx: -6, dy: -42, tilt: -5, what: 'Opened ai/services' },
]

export const QUESTION = "How does HireLens stop the AI from crediting a skill the resume doesn't have?"
export const ANSWER = [
  'The model has to quote the resume for every skill it claims, and the code checks that the quote is really there',
  { cite: 1 },
  '. No quote, no credit',
  { cite: 2 },
  '.',
]
export const CODE = [
  { n: 55, text: '    p = _norm(part)' },
  { n: 56, text: "    if p and f' {p} ' in haystack:", hl: true },
  { n: 57, text: '        return True', hl: true },
]
// small enough to index in under a minute (big repos like django/django go over the 50 MB limit)
export const TRY = ['pallets/flask', 'psf/requests', 'mohanrajtunes/hirelens']
