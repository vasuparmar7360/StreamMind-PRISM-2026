"use client"
import { ArrowRight, CalendarDays, Code2, FileText, Settings2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export function DecisionChanges() {
  const [changes, setChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChanges = async () => {
      try {
        setLoading(true)
        const res = await api.getDecisions()
        const activeSuperseded = res.decisions
          .filter(d => d.status === "active" && d.supersedes_decision_id)
          .sort((a, b) => new Date(b.updated_at || b.created_at || "").getTime() - new Date(a.updated_at || a.created_at || "").getTime())
          .slice(0, 2)
        
        const detailedChanges = await Promise.all(
          activeSuperseded.map(async (d) => {
            try {
              const detail = await api.getDecisionById(d.id)
              const previous = detail.lineage.length > 0 ? detail.lineage[0].value : "Unknown"
              return {
                id: d.id,
                title: d.topic,
                previous: previous,
                current: d.value,
                reason: d.reason || "Updated based on new evidence.",
                source: d.source_document || "System",
                date: d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "Just now",
              }
            } catch (e) {
              return {
                id: d.id,
                title: d.topic,
                previous: "Unknown",
                current: d.value,
                reason: d.reason || "Updated based on new evidence.",
                source: d.source_document || "System",
                date: d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "Just now",
              }
            }
          })
        )
        setChanges(detailedChanges)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchChanges()
  }, [])

  if (!loading && changes.length === 0) return null

  return (
    <section aria-labelledby="decision-changes-heading" className="mt-10 animate-card-enter stagger-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="decision-changes-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
        >
          Recent Decision Changes
        </h2>
        <span className="text-[11px] text-text-muted">{changes.length} update{changes.length !== 1 && 's'}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <div className="surface-card h-64 border border-border/50 animate-pulse rounded-2xl bg-surface/50"></div>
            <div className="surface-card h-64 border border-border/50 animate-pulse rounded-2xl bg-surface/50"></div>
          </>
        ) : changes.map((decision) => {
          const Icon = Settings2

          return (
            <article key={decision.id} aria-labelledby={`${decision.id}-title`}>
              <Card className="surface-card card-accent-brand h-full [--card-spacing:--spacing(5)]">
                <CardHeader className="items-center">
                  <CardTitle>
                    <h3 id={`${decision.id}-title`} className="flex items-center gap-2.5 text-text-secondary">
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
                      {decision.title}
                    </h3>
                  </CardTitle>
                  <CardAction className="self-center">
                    <Badge variant="current">
                      <span aria-hidden="true" className="size-1 rounded-full bg-brand-primary" />
                      CURRENT
                    </Badge>
                  </CardAction>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-background-secondary/60 p-3.5">
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="text-[10px] font-medium text-text-muted">Previous Decision</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-lg font-medium tracking-tight text-text-muted line-through decoration-text-muted/40">
                          {decision.previous}
                        </p>
                        <Badge variant="replaced">Replaced</Badge>
                      </div>
                    </div>
                    <ArrowRight aria-hidden="true" className="size-4 text-brand-primary/50" />
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="text-[10px] font-medium text-text-muted">Current Decision</p>
                      <p className="text-xl font-semibold tracking-tight text-brand-primary-hover">
                        {decision.current}
                      </p>
                    </div>
                  </div>

                  <dl className="flex flex-col gap-1.5">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Reason
                    </dt>
                    <dd className="text-xs leading-relaxed text-text-secondary">{decision.reason}</dd>
                  </dl>
                </CardContent>

                <CardFooter className="justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-2 text-text-muted">
                    <FileText aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="sr-only">Source: </span>
                    <span className="truncate text-[11px]" title={decision.source}>
                      {decision.source}
                    </span>
                  </div>
                  <span className="shrink-0 text-[11px] text-text-muted">
                    <span className="sr-only">Updated </span>
                    {decision.date}
                  </span>
                </CardFooter>
              </Card>
            </article>
          )
        })}
      </div>
    </section>
  )
}
