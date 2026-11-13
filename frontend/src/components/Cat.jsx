import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

// Nyan Cat flies across the page now and then, bobbing along with its rainbow.
export default function Cat() {
  const nyan = useRef(null)
  const api = useRef({})
  const [caught, setCaught] = useState(() => { try { return Number(localStorage.getItem('sift:nyans') || 0) } catch { return 0 } })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let anim, timer, tl, alive = true

    const fly = async () => {
      if (!anim) {
        // the animation loads only the first time it flies, so the page stays fast
        const [{ default: lottie }, { default: data }] = await Promise.all([
          import('lottie-web/build/player/lottie_light'), import('../assets/nyan.json'),
        ])
        if (!alive) return
        anim = lottie.loadAnimation({ container: nyan.current.querySelector('.nyan-box'), renderer: 'svg', loop: true, autoplay: false, animationData: data })
      }
      anim.play()
      const W = window.innerWidth, H = window.innerHeight
      const goRight = Math.random() < 0.5
      gsap.set(nyan.current, { top: gsap.utils.random(80, H - 200), scaleX: goRight ? 1 : -1, x: goRight ? -220 : W + 40, y: 0, autoAlpha: 1 })
      tl = gsap.timeline({ onComplete: () => { gsap.set(nyan.current, { autoAlpha: 0 }); anim.pause(); next() } })
        .to(nyan.current, { x: goRight ? W + 40 : -220, duration: 3.4, ease: 'none' })
        .to(nyan.current, { y: -18, duration: 0.4, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
    }
    const next = () => { timer = setTimeout(fly, gsap.utils.random(9000, 18000)) }

    // press N to call the cat whenever you want
    const key = (e) => {
      if (e.key.toLowerCase() !== 'n' || /input|textarea/i.test(e.target.tagName) || tl?.isActive()) return
      clearTimeout(timer); fly()
    }
    api.current = {
      fast: (on) => tl && gsap.to(tl, { timeScale: on ? 2.6 : 1, duration: 0.3 }),
      loop: () => {
        if (!tl) return
        tl.pause()
        const box = nyan.current.querySelector('.nyan-box')
        gsap.timeline({ onComplete: () => tl.play() })
          .to(box, { rotation: '-=360', duration: 0.7, ease: 'power2.inOut', transformOrigin: '50% 50%' })
          .to(box, { scale: 1.25, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0)
        const r = box.getBoundingClientRect()
        for (let i = 0; i < 10; i++) {
          const st = document.createElement('span')
          st.className = 'nyan-star'; st.textContent = '✦'
          st.style.left = `${r.left + r.width / 2}px`; st.style.top = `${r.top + r.height / 2}px`
          st.style.color = ['#FF48B0', '#FFE24A', '#00A95C', '#3255A4', '#FF7A3D'][i % 5]
          document.body.appendChild(st)
          gsap.to(st, { x: gsap.utils.random(-140, 140), y: gsap.utils.random(-140, 140), rotation: gsap.utils.random(-180, 180), autoAlpha: 0, duration: 0.9, ease: 'power2.out', onComplete: () => st.remove() })
        }
      },
    }
    window.addEventListener('keydown', key)
    timer = setTimeout(fly, 2500)
    return () => { alive = false; clearTimeout(timer); tl?.kill(); anim?.destroy(); window.removeEventListener('keydown', key) }
  }, [])

  return (
    <>
      <div className="nyan" ref={nyan} aria-hidden="true"
        onPointerEnter={() => api.current.fast?.(true)} onPointerLeave={() => api.current.fast?.(false)}
        onClick={() => {
          api.current.loop?.()
          setCaught((c) => { const n = c + 1; try { localStorage.setItem('sift:nyans', n) } catch { /* fine */ } return n })
        }}>
        <div className="nyan-box" />
      </div>
      {caught > 0 && <div className="nyan-count" title="Press N to call the cat">Nyans caught: {caught}</div>}
    </>
  )
}
