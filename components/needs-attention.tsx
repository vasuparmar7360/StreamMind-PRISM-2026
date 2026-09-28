"use client"

import { useState, useEffect } from "react"
import { ArrowUpRight, Clock, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export function NeedsAttention() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttention = async () => {
      try {
        setLoading(true)
        const [conflictsRes, actionsRes] = await Promise.all([
          api.getConflicts("open"),
          api.getActions("pending")
        ])

        const attentionList: any[] = []
        
        // Add open conflicts
        if (conflictsRes.conflicts) {
          conflictsRes.conflicts.slice(0, 2).forEach(c => {
            attentionList.push({
              id: c.id,
              title: "Decision Conflict",
              description: c.topic,
              status: "conflict",
              action: "Review Evidence",
              icon: TriangleAlert,
              href: "/decisions"
            })
          })
        }
        
        // Add pending actions
        if (actionsRes.actions) {
          actionsRes.actions.slice(0, 2).forEach(a => {
            attentionList.push({
              id: a.id,
              title: "Pending Action",
              description: a.title,
              status: "pending",
              action: "Review Action",
              icon: Clock,
              href: "/actions"
            })
          })
        }

        setItems(attentionList.slice(0, 4))
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchAttention()
  }, [])

  if (!loading && items.length === 0) return null

  return (
    <section aria-labelledby="attention-heading" className="mt-10 animate-card-enter stagger-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="attention-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
        >
          Needs Your Attention
        </h2>
        <span className="text-[11px] text-text-muted">{items.length} item{items.length !== 1 && 's'}</span>
      </div>

      <ul className="divide-y divide-[rgba(255,255,255,0.06)] surface-card/80">
        {loading ? (
           <div className="p-4 h-24 flex items-center justify-center text-xs text-text-muted animate-pulse">Loading attention items...</div>
        ) : items.map(({ id, title, description, status, action, icon: Icon, href }) => (
          <li key={id}>
          <div
            className={cn(
              "flex flex-wrap items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-brand-primary/[0.04]",
            )}
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                status === "conflict"
                  ? "bg-warning/10 text-warning ring-warning/15"
                  : "bg-brand-secondary/10 text-brand-secondary ring-brand-secondary/15",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xs font-medium text-text-primary">{title}</h3>
                <Badge variant={status as any}>{status.toUpperCase()}</Badge>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">{description}</p>
            </div>

            <Link href={href}>
              <Button variant="ghost" size="sm">
                {action}
                <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
              </Button>
            </Link>
          </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
