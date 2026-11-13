import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <p className="ft-big">Built by Mohanraj S, a developer from Puducherry who likes AI that shows its work.</p>
      <div className="ft-links">
        <a href="https://github.com/mohanrajtunes" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://www.linkedin.com/in/mohanraj-seenuvasaperumal-3795ab37b" target="_blank" rel="noreferrer">LinkedIn</a>
        <a href="https://mohanrajtunes.github.io/portfolio" target="_blank" rel="noreferrer">Portfolio</a>
        <Link to="/built">How it's built</Link>
        <Link to="/evals">Evals</Link>
      </div>
      <p className="ft-small">Sift reads public repos only. Free to use, with fair limits so the demo stays up.</p>
    </footer>
  )
}
