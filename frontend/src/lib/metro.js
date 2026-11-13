// Turns the repo graph (files + imports) into a metro map:
// one line per folder, one station per file, imports drawn as thin transfer links.

export const INKS = ['#FF48B0', '#3255A4', '#FF7A3D', '#00A95C', '#765BA7', '#00838A', '#D9A400', '#E8483F']
const MAX_LINES = 9
const MAX_STATIONS = 11
export const WIDTH = 1000
const ROW = 100
const TOP = 70

export function layoutMetro(graph) {
  const degree = {}
  graph.edges.forEach(({ source, target }) => {
    degree[source] = (degree[source] || 0) + 1
    degree[target] = (degree[target] || 0) + 1
  })
  const folders = {}
  graph.nodes.forEach((n) => { (folders[n.folder] ||= []).push(n) })
  const ranked = Object.entries(folders).sort((a, b) => b[1].length - a[1].length)
  const shown = ranked.slice(0, MAX_LINES)

  const stations = {}
  const lines = shown.map(([folder, files], i) => {
    const pick = [...files]
      .sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0) || b.lines - a.lines)
      .slice(0, MAX_STATIONS)
      .sort((a, b) => a.id.localeCompare(b.id))
    const y = TOP + i * ROW
    const x0 = 40 + (i % 3) * 26
    const startX = x0 + 150
    const gap = Math.min(86, (WIDTH - startX - 30) / Math.max(pick.length - 1, 1))
    const color = INKS[i % INKS.length]
    // longer lines take a 45 degree jog halfway, like a real metro map
    const k = pick.length >= 4 ? Math.ceil(pick.length / 2) : pick.length
    const jog = i % 2 ? 22 : -22
    pick.forEach((f, j) => {
      const name = f.id.split('/').pop()
      stations[f.id] = {
        id: f.id, folder, x: startX + j * gap, y: j < k ? y : y + jog, color, lines: f.lines,
        name: name.length > 18 ? name.slice(0, 16) + '…' : name, above: j % 2 === 1,
      }
    })
    const endX = startX + (pick.length - 1) * gap + 24
    let d = `M${x0},${y - 26} L${x0 + 26},${y}`
    if (k < pick.length) {
      const a = startX + (k - 1) * gap + (gap - 22) / 2
      d += ` H${a} L${a + 22},${y + jog} H${endX}`
    } else d += ` H${endX}`
    return {
      folder, color, y, hidden: files.length - pick.length, d,
      labelX: x0, labelY: y - 34,
    }
  })

  const links = graph.edges
    .filter((e) => stations[e.source] && stations[e.target])
    .map((e) => {
      const a = stations[e.source], b = stations[e.target]
      const bend = a.y === b.y ? -40 : (b.x - a.x) * 0.15
      return { ...e, d: `M${a.x},${a.y} Q${(a.x + b.x) / 2 + bend},${(a.y + b.y) / 2 - Math.abs(bend)} ${b.x},${b.y}` }
    })

  return {
    lines, stations, links,
    height: TOP + Math.max(lines.length, 1) * ROW,
    hiddenFolders: ranked.length - shown.length,
  }
}
