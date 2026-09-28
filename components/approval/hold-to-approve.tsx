"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const HOLD_MS = 800
const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type HoldToApproveProps = {
  onComplete: () => void
  disabled?: boolean
  disabledLabel?: string
  label?: string
  className?: string
}

export function HoldToApprove({
  onComplete,
  disabled = false,
  disabledLabel = "Review required",
  label = "Hold to approve",
  className,
}: HoldToApproveProps) {
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)
  const startedAt = useRef(0)

  const cancel = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = null
    setProgress(0)
  }, [])

  const begin = useCallback(() => {
    if (disabled || frame.current) return
    startedAt.current = performance.now()
    const tick = (now: number) => {
      const next = Math.min((now - startedAt.current) / HOLD_MS, 1)
      setProgress(next)
      if (next < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        frame.current = null
        setProgress(0)
        onComplete()
      }
    }
    frame.current = requestAnimationFrame(tick)
  }, [disabled, onComplete])

  useEffect(() => cancel, [cancel])

  const pressing = progress > 0
  const status = disabled ? disabledLabel : pressing ? "Keep holding…" : label

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? disabledLabel : `${label}. Press and hold for under a second.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          begin()
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault()
            begin()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") cancel()
        }}
        onBlur={cancel}
        onContextMenu={(event) => event.preventDefault()}
        className="relative grid size-11 shrink-0 touch-none select-none place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-approval-pending focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--rule)" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--approval-pending)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full font-display text-base italic text-[color-mix(in_srgb,var(--approval-pending)_30%,black)] motion-safe:transition-transform motion-safe:duration-150"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--approval-pending) 55%, white), var(--approval-pending) 55%, color-mix(in srgb, var(--approval-pending) 60%, black))",
            boxShadow: pressing
              ? "inset 0 2px 6px rgba(0,0,0,.45)"
              : "0 3px 8px rgba(0,0,0,.35), inset 0 -2px 4px rgba(0,0,0,.2)",
            transform: pressing ? `scale(${1 - progress * 0.12})` : undefined,
          }}
        >
          O
        </span>
      </button>
      <span
        aria-live="polite"
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.14em]",
          disabled ? "text-text-muted" : "text-approval-pending",
        )}
      >
        {status}
      </span>
    </div>
  )
}
