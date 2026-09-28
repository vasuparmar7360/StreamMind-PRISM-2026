"use client"

import { useEffect, type ReactNode } from "react"
import { motion, useAnimate, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export type StampVerdict = "approved" | "denied"

const STAMP_COPY: Record<StampVerdict, { word: string; className: string }> = {
  approved: { word: "APPROVED", className: "border-approval-confirmed-fg text-approval-confirmed-fg" },
  denied: { word: "DENIED", className: "border-approval-deny-fg text-approval-deny-fg" },
}

export function ApprovalStamp({ verdict, fresh, className }: { verdict: StampVerdict; fresh: boolean; className?: string }) {
  const reduceMotion = useReducedMotion()
  const { word, className: tone } = STAMP_COPY[verdict]
  const drop = fresh && !reduceMotion

  return (
    <motion.div
      aria-hidden="true"
      initial={drop ? { opacity: 0, scale: 2.4, rotate: -22 } : false}
      animate={{ opacity: 1, scale: 1, rotate: -8 }}
      transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.9 }}
      className={cn(
        "pointer-events-none absolute right-5 top-5 z-10 flex flex-col items-center rounded-sm border-[3px] border-double bg-surface/70 px-3 py-1 font-mono leading-none backdrop-blur-[1px]",
        tone,
        className,
      )}
    >
      <span className="text-base font-bold tracking-[0.25em]">{word}</span>
      <span className="mt-1 text-[8px] tracking-[0.2em]">OWNMIND · LOCAL</span>
    </motion.div>
  )
}

/** Wraps a card so a fresh verdict stamps onto it and gives the card a brief shake as it lands. */
export function StampSurface({
  verdict,
  fresh,
  className,
  children,
}: {
  verdict: StampVerdict | null
  fresh: boolean
  className?: string
  children: ReactNode
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!verdict || !fresh || reduceMotion || !scope.current) return
    animate(
      scope.current,
      { x: [0, -4, 3, -2, 1, 0], y: [0, 2, -1, 1, 0, 0] },
      { duration: 0.34, delay: 0.12, ease: "easeOut" },
    )
  }, [animate, fresh, reduceMotion, scope, verdict])

  return (
    <div ref={scope} className={cn("relative", className)}>
      {children}
      {verdict && <ApprovalStamp verdict={verdict} fresh={fresh} />}
    </div>
  )
}
