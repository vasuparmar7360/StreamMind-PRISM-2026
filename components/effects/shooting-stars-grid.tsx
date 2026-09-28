"use client"

import { useCallback, useEffect, useRef } from "react"
import { useInView, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type ShootingStarsGridProps = {
  className?: string
  gridSize?: number
  /** CSS colors; CSS variables are allowed because stars are styled through the DOM. */
  colors?: string[]
  maxActiveStars?: number
  spawnEveryMs?: [number, number]
  speedMs?: [number, number]
  trailLength?: number
}

const DEFAULT_COLORS = ["var(--brand-primary)", "var(--brand-secondary)", "var(--approval-pending)"]
const MASK = "radial-gradient(ellipse at center, #000 20%, transparent 72%)"

export function ShootingStarsGrid({
  className,
  gridSize = 44,
  colors = DEFAULT_COLORS,
  maxActiveStars = 10,
  spawnEveryMs = [300, 800],
  speedMs = [1800, 3400],
  trailLength = 90,
}: ShootingStarsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const starsRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const inView = useInView(containerRef, { margin: "80px" })
  const reduceMotion = useReducedMotion()

  const spawnStar = useCallback(() => {
    const layer = starsRef.current
    const container = containerRef.current
    if (!layer || !container || layer.childElementCount >= maxActiveStars) return

    const { width, height } = container.getBoundingClientRect()
    const horizontal = Math.random() > 0.5
    const forward = Math.random() > 0.5
    const color = colors[Math.floor(Math.random() * colors.length)]
    const duration = speedMs[0] + Math.random() * (speedMs[1] - speedMs[0])
    const star = document.createElement("span")
    const direction = horizontal ? (forward ? "right" : "left") : forward ? "bottom" : "top"

    Object.assign(star.style, {
      position: "absolute",
      borderRadius: "999px",
      pointerEvents: "none",
      background: `linear-gradient(to ${direction}, transparent, ${color} 80%, color-mix(in srgb, ${color} 40%, white) 100%)`,
    } satisfies Partial<CSSStyleDeclaration>)

    let keyframes: Keyframe[]
    if (horizontal) {
      const row = Math.floor(Math.random() * (Math.floor(height / gridSize) + 1))
      Object.assign(star.style, { top: `${row * gridSize}px`, height: "1px", width: `${trailLength}px` })
      star.style[forward ? "left" : "right"] = `-${trailLength}px`
      const distance = width + trailLength * 2
      keyframes = [{ transform: "translateX(0)" }, { transform: `translateX(${forward ? "" : "-"}${distance}px)` }]
    } else {
      const col = Math.floor(Math.random() * (Math.floor(width / gridSize) + 1))
      Object.assign(star.style, { left: `${col * gridSize}px`, width: "1px", height: `${trailLength}px` })
      star.style[forward ? "top" : "bottom"] = `-${trailLength}px`
      const distance = height + trailLength * 2
      keyframes = [{ transform: "translateY(0)" }, { transform: `translateY(${forward ? "" : "-"}${distance}px)` }]
    }

    layer.appendChild(star)
    const animation = star.animate(keyframes, { duration, easing: "linear" })
    animation.onfinish = () => star.remove()
    animation.oncancel = () => star.remove()
  }, [colors, gridSize, maxActiveStars, speedMs, trailLength])

  useEffect(() => {
    if (reduceMotion || !inView) return
    const loop = () => {
      if (document.visibilityState === "visible") spawnStar()
      const delay = spawnEveryMs[0] + Math.random() * (spawnEveryMs[1] - spawnEveryMs[0])
      timeoutRef.current = window.setTimeout(loop, delay)
    }
    timeoutRef.current = window.setTimeout(loop, 500)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [inView, reduceMotion, spawnEveryMs, spawnStar])

  return (
    <div ref={containerRef} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0 motion-safe:animate-[grid-breathe_6s_ease-in-out_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--rule) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--rule) 55%, transparent) 1px, transparent 1px)",
          backgroundSize: `${gridSize}px ${gridSize}px`,
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      />
      <div ref={starsRef} className="absolute inset-0" style={{ maskImage: MASK, WebkitMaskImage: MASK }} />
      <div className="absolute left-1/2 top-1/2 h-40 w-[28rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/[0.06] blur-3xl" />
    </div>
  )
}
