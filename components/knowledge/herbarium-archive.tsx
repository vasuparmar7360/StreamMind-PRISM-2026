"use client"

import { useState, type PointerEvent } from "react"
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KnowledgeDocument } from "@/lib/knowledge-data"

const EMBEDDING_DIMS = 768
const FOLD_DELAY_MS = 650

function catalogueNumber(id: string) {
  const digits = id.replace(/\D/g, "")
  return `No. ${digits.padStart(4, "0")}`
}

function chunkCount(document: KnowledgeDocument) {
  return document.factCount * 4 + document.decisionCount * 3 + document.highlights.length
}

type HerbariumArchiveProps = {
  documents: KnowledgeDocument[]
  onOpen: (document: KnowledgeDocument) => void
}

export function HerbariumArchive({ documents, onOpen }: HerbariumArchiveProps) {
  const [forgotten, setForgotten] = useState<Set<string>>(() => new Set())
  const [voided, setVoided] = useState<Set<string>>(() => new Set())
  const reduceMotion = useReducedMotion()
  const visible = documents.filter((document) => !forgotten.has(document.id))

  function forget(id: string) {
    setVoided((prev) => new Set(prev).add(id))
    window.setTimeout(
      () => setForgotten((prev) => new Set(prev).add(id)),
      reduceMotion ? 0 : FOLD_DELAY_MS,
    )
  }

  function restoreAll() {
    setForgotten(new Set())
    setVoided(new Set())
  }

  return (
    <div className="herbarium overflow-hidden rounded-3xl border border-rule">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule px-6 py-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">Herbarium Archive</p>
          <p className="mt-1 font-display text-2xl text-foreground">
            {visible.length} {visible.length === 1 ? "specimen" : "specimens"} pressed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-text-muted">Embeddings · {EMBEDDING_DIMS}-d · on device</span>
          {forgotten.size > 0 && (
            <Button variant="outline" size="sm" onClick={restoreAll}>
              Restore {forgotten.size} forgotten
            </Button>
          )}
        </div>
      </div>

      <ul className="columns-1 gap-5 p-6 [column-fill:_balance] sm:columns-2 min-[1150px]:columns-3">
        <AnimatePresence initial={false}>
          {visible.map((document, index) => (
            <SpecimenCard
              key={document.id}
              document={document}
              index={index}
              isVoid={voided.has(document.id)}
              onOpen={() => onOpen(document)}
              onForget={() => forget(document.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      {visible.length === 0 && (
        <div className="px-6 pb-10 text-center">
          <p className="font-display text-lg text-foreground">The archive is empty.</p>
          <p className="mt-1 text-xs text-text-muted">Every specimen in this view has been forgotten for this session.</p>
        </div>
      )}

      <p className="border-t border-rule px-6 py-3 text-[10px] text-text-muted">
        Forgetting removes a specimen from this archive view for the session. Source files are not deleted.
      </p>
    </div>
  )
}

type SpecimenCardProps = {
  document: KnowledgeDocument
  index: number
  isVoid: boolean
  onOpen: () => void
  onForget: () => void
}

function SpecimenCard({ document, index, isVoid, onOpen, onForget }: SpecimenCardProps) {
  const reduceMotion = useReducedMotion()
  const [confirming, setConfirming] = useState(false)
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [3, -3]), { stiffness: 180, damping: 18 })
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-4, 4]), { stiffness: 180, damping: 18 })
  const tapeX = useTransform(pointerX, [-0.5, 0.5], [-5, 5])
  const tapeY = useTransform(pointerY, [-0.5, 0.5], [-4, 4])
  const restingTilt = index % 3 === 0 ? -0.6 : index % 3 === 1 ? 0.5 : -0.2

  function track(event: PointerEvent<HTMLElement>) {
    if (reduceMotion || isVoid) return
    const rect = event.currentTarget.getBoundingClientRect()
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function settle() {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={false}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, rotateX: 78, scaleY: 0.2, height: 0, marginBottom: 0, transition: { duration: 0.45, ease: [0.55, 0, 0.8, 0.3] } }
      }
      style={{ transformOrigin: "top center", perspective: 900 }}
      className="mb-5 break-inside-avoid"
    >
      <motion.article
        onPointerMove={track}
        onPointerLeave={settle}
        style={{ rotateX: tiltX, rotateY: tiltY, rotate: restingTilt }}
        whileHover={reduceMotion ? undefined : { y: -3 }}
        className={cn(
          "relative rounded-sm border border-rule bg-surface shadow-[0_1px_0_var(--rule-soft),0_10px_24px_-14px_var(--hard-shadow)]",
          index % 4 === 1 && "bg-background-secondary",
        )}
      >
        <motion.span
          aria-hidden="true"
          style={{ x: tapeX, y: tapeY }}
          className="absolute -right-4 -top-2 h-6 w-20 rotate-[38deg] bg-herb-tape shadow-[0_1px_2px_var(--rule)]"
        />
        <motion.span
          aria-hidden="true"
          style={{ x: tapeX, y: tapeY }}
          className="absolute -bottom-2 -left-4 h-6 w-20 rotate-[38deg] bg-herb-tape shadow-[0_1px_2px_var(--rule)]"
        />

        <div className="px-5 pb-4 pt-5">
          <p className="font-mono text-[11px] text-text-muted">Catalogue {catalogueNumber(document.id)}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words font-display text-xl leading-tight text-foreground">
              {document.filename.replace(/_/g, " ").replace(/\.[a-z]+$/i, "")}
            </h3>
            <span className="shrink-0 -rotate-6 rounded-[3px] border-[1.5px] border-foreground/70 px-1.5 py-0.5 text-center font-mono leading-none text-foreground">
              <span className="block text-[8px] uppercase tracking-[0.1em]">Embedding</span>
              <span className="block text-sm">{EMBEDDING_DIMS}-d</span>
            </span>
          </div>

          <p className="mt-3 text-pretty text-xs leading-relaxed text-text-secondary">{document.insight}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-rule pt-3 font-mono text-[11px]">
            <dt className="text-text-muted">Chunks</dt>
            <dd className="text-right text-foreground">{chunkCount(document)}</dd>
            <dt className="text-text-muted">Facts</dt>
            <dd className="text-right text-foreground">{document.factCount}</dd>
            <dt className="text-text-muted">Pressed</dt>
            <dd className="text-right text-foreground">{document.added}</dd>
            <dt className="text-text-muted">Kind</dt>
            <dd className="text-right text-foreground">{document.category}</dd>
          </dl>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-rule bg-background/60 px-5 py-2.5">
          {confirming && !isVoid ? (
            <>
              <span className="text-[11px] text-foreground">Forget this specimen?</span>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <Button variant="destructive" size="xs" onClick={onForget}>
                  Forget
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="link" size="xs" className="px-0 text-foreground" onClick={onOpen} disabled={isVoid}>
                Metadata
              </Button>
              <Button
                size="xs"
                disabled={isVoid}
                onClick={() => setConfirming(true)}
                className="bg-herb-oxblood text-herb-bone hover:bg-herb-oxblood/90"
              >
                Forget
              </Button>
            </>
          )}
        </div>

        <AnimatePresence>
          {isVoid && (
            <motion.div
              aria-hidden="true"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -24 }}
              animate={{ opacity: 1, scale: 1, rotate: -12 }}
              transition={{ type: "spring", stiffness: 520, damping: 20 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <span className="rounded-sm border-4 border-double border-herb-oxblood bg-surface/60 px-5 py-1 font-mono text-3xl font-bold tracking-[0.3em] text-herb-oxblood">
                VOID
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <span role="status" className="sr-only">
          {isVoid ? `${document.filename} forgotten` : ""}
        </span>
      </motion.article>
    </motion.li>
  )
}
