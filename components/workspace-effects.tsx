"use client"

import { useEffect, useRef } from "react"

/** Pointer updates run at most once per frame. No React renders on pointer movement. */
export function AmbientField() {
  const field = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: no-preference) and (pointer: fine)")
    let frame = 0
    let active: HTMLElement | null = null
    let latest: PointerEvent | null = null
    function reset() {
      cancelAnimationFrame(frame)
      frame = 0
      active?.removeAttribute("data-illuminated")
      active = null
      field.current?.style.removeProperty("--parallax-x")
      field.current?.style.removeProperty("--parallax-y")
    }
    function update() {
      frame = 0
      if (!latest || !media.matches) return
      const { clientX: x, clientY: y, target } = latest
      const card = target instanceof Element ? target.closest<HTMLElement>(".surface-card, [data-depth]") : null
      // Read geometry before writing styles to avoid interleaved layout reads/writes.
      const rect = card?.getBoundingClientRect()
      if (active !== card) active?.removeAttribute("data-illuminated")
      active = card
      field.current?.style.setProperty("--parallax-x", `${(x / window.innerWidth - 0.5) * 24}px`)
      field.current?.style.setProperty("--parallax-y", `${(y / window.innerHeight - 0.5) * 18}px`)
      if (card && rect) {
        card.style.setProperty("--light-x", `${x - rect.left}px`)
        card.style.setProperty("--light-y", `${y - rect.top}px`)
        card.setAttribute("data-illuminated", "true")
      }
    }
    function move(event: PointerEvent) {
      if (!media.matches) return
      latest = event
      if (!frame) frame = requestAnimationFrame(update)
    }
    document.addEventListener("pointermove", move, { passive: true })
    document.documentElement.addEventListener("pointerleave", reset)
    window.addEventListener("blur", reset)
    media.addEventListener("change", reset)
    return () => {
      reset()
      document.removeEventListener("pointermove", move)
      document.documentElement.removeEventListener("pointerleave", reset)
      window.removeEventListener("blur", reset)
      media.removeEventListener("change", reset)
    }
  }, [])
  return (
    <div ref={field} className="ambient-field" aria-hidden="true">
      <div className="ambient-pinpoints" />
      <div className="ambient-ribbons">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

/** Keep the final value accessible and server-rendered, animate only its visual copy. */
export function CountUp({ value }: { value: number }) {
  const display = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    let frame = 0
    const start = performance.now()
    function finish() {
      cancelAnimationFrame(frame)
      if (display.current) display.current.textContent = String(value)
    }
    function tick(now: number) {
      const progress = Math.min((now - start) / 850, 1)
      if (display.current) display.current.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    media.addEventListener("change", finish)
    return () => { finish(); media.removeEventListener("change", finish) }
  }, [value])
  return <><span className="sr-only">{value}</span><span aria-hidden="true" ref={display}>{value}</span></>
}
