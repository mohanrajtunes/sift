import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { gsap } from 'gsap'

// Riso ink wipe between pages: blue ink, then pink, sweep off the screen while the little train rides through.
export default function Wipe() {
  const { pathname } = useLocation()
  const first = useRef(true)
  const root = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (first.current) { first.current = false; return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline()
    tl.set(root.current, { autoAlpha: 1 })
      .set(q('.wipe-ink'), { xPercent: 0 })
      .set(q('.wipe-train'), { x: '-20vw' })
      .to(q('.wipe-train'), { x: '120vw', duration: 0.9, ease: 'power2.in' }, 0)
      .to(q('.wipe-blue'), { xPercent: 102, duration: 0.7, ease: 'power3.inOut' }, 0.15)
      .to(q('.wipe-pink'), { xPercent: 102, duration: 0.7, ease: 'power3.inOut' }, 0.05)
      .set(root.current, { autoAlpha: 0 })
    return () => tl.kill()
  }, [pathname])

  return (
    <div className="wipe" ref={root} aria-hidden="true">
      <div className="wipe-ink wipe-pink" />
      <div className="wipe-ink wipe-blue" />
      <div className="wipe-train"><span /></div>
    </div>
  )
}
