"use client"

import { useState, useEffect } from "react"
import {
  GitBranch,
  FileText,
  AlertTriangle,
  Link2,
  ChevronDown,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
  Zap,
  ArrowDown,
  User,
  FolderOpen,
  CircleDot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type DecisionLineage,
  type DecisionDetail,
  type ConflictDecision,
} from "@/lib/decisions-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type DecisionRecord, type ConflictRecord } from "@/lib/api"

// Dummy fallback variables so types don't break if anything references them elsewhere
const decisionStats = [] as any[]
const statIconMap = {
  "Active Decisions": GitBranch,
  "Replaced Decisions": ChevronDown,
  "Conflicts Detected": AlertTriangle,
  "Total Decisions": Link2,
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const accentMap = {
  cyan: {
    text: "text-brand-primary-hover",
    icon: "bg-brand-primary/10 text-brand-primary-hover ring-brand-primary/20",
    ring: "hover:ring-brand-primary/30",
    glow: "from-brand-primary/15",
  },
  blue: {
    text: "text-brand-primary-hover",
    icon: "bg-brand-primary/10 text-brand-primary-hover ring-brand-primary/20",
    ring: "hover:ring-brand-primary/30",
    glow: "from-brand-primary/15",
  },
  purple: {
    text: "text-brand-secondary",
    icon: "bg-brand-secondary/10 text-brand-secondary ring-brand-secondary/20",
    ring: "hover:ring-brand-secondary/30",
    glow: "from-brand-secondary/12",
  },
  conflict: {
    text: "text-warning",
    icon: "bg-warning/10 text-warning ring-warning/20",
    ring: "hover:ring-warning/30",
    glow: "from-warning/12",
  },
}


// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "CURRENT" | "REPLACED" | "CONFLICT" }) {
  if (status === "CURRENT") return <Badge variant="current"><span className="size-1 rounded-full bg-brand-primary" />CURRENT</Badge>
  if (status === "REPLACED") return <Badge variant="replaced">REPLACED</Badge>
  return <Badge variant="conflict"><span className="size-1 rounded-full bg-warning" />CONFLICT</Badge>
}

// ─── Timeline entry card ──────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isLast,
  onClick,
}: {
  entry: DecisionLineage["entries"][number]
  isLast: boolean
  onClick?: () => void
}) {
  const isCurrent = entry.status === "CURRENT"
  const isReplaced = entry.status === "REPLACED"

  return (
    <div className="flex items-start gap-4">
      {/* Vertical track */}
      <div className="flex flex-col items-center">
        {/* Date circle */}
        <div
          className={cn(
            "relative flex size-12 shrink-0 flex-col items-center justify-center rounded-full border text-center transition-all duration-300",
            isCurrent
              ? "border-brand-primary/40 bg-brand-primary/10 shadow-none"
              : "border-border bg-surface/50",
          )}
        >
          <span
            className={cn(
              "text-[9px] font-bold tracking-widest",
              isCurrent ? "text-brand-primary-hover" : "text-text-muted",
            )}
          >
            {entry.dateShort.split(" ")[0]}
          </span>
          <span
            className={cn(
              "text-[9px] font-semibold",
              isCurrent ? "text-brand-primary/80" : "text-text-muted",
            )}
          >
            {entry.dateShort.split(" ")[1]}
          </span>
          {isCurrent && (
            <span className="absolute inset-0 rounded-full shadow-none animate-signal-pulse" />
          )}
        </div>

        {/* Connector line + arrow */}
        {!isLast && (
          <div className="lineage-connector flex flex-col items-center py-1">
            <div className="w-px flex-1 bg-gradient-to-b from-brand-primary/30 to-[rgba(255,255,255,0.04)]" style={{ height: "28px" }} />
            <ArrowDown className="size-3.5 text-brand-primary/40" />
            <div className="w-px flex-1 bg-gradient-to-b from-[rgba(255,255,255,0.04)] to-brand-primary/20" style={{ height: "8px" }} />
          </div>
        )}
      </div>

      {/* Entry card */}
      <button
        onClick={onClick}
        className={cn(
          "group mb-4 min-w-0 flex-1 cursor-pointer p-5 text-left transition-all duration-200 surface-card",
          isCurrent
            ? "card-accent-gold current-decision"
            : "",
          isReplaced && "opacity-65 hover:opacity-90",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isCurrent ? (
              <CircleDot className="size-4 shrink-0 text-brand-primary" />
            ) : (
              <CircleDot className="size-4 shrink-0 text-text-muted/40" />
            )}
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-widest",
                isCurrent ? "text-brand-primary-hover" : "text-text-muted",
              )}
            >
              {isCurrent ? "Current Decision" : "Original Decision"}
            </span>
          </div>
          <StatusBadge status={entry.status} />
        </div>

        <p
          className={cn(
            "mb-3 text-sm font-medium leading-snug",
            isCurrent ? "text-text-primary" : "text-text-muted line-through decoration-text-muted/30",
          )}
        >
          {entry.label}
        </p>

        {entry.reason && (
          <div className="mb-3 rounded-lg border border-brand-primary/10 bg-brand-primary/[0.04] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Reason</p>
            <p className="mt-0.5 text-xs text-text-secondary">{entry.reason}</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="size-3 shrink-0" />
          <span className="text-[11px]">{entry.source}</span>
        </div>
      </button>
    </div>
  )
}

// ─── Lineage block ───────────────────────────────────────────────────────────

function LineageBlock({
  lineage,
  onSelectDetail,
}: {
  lineage: DecisionLineage
  onSelectDetail: (id: string) => void
}) {
  const currentEntry = lineage.entries.find((e) => e.status === "CURRENT")!
  const replacedCount = lineage.entries.filter((e) => e.status === "REPLACED").length

  return (
    <article className="surface-card card-accent-brand p-6 transition-all duration-300">
      {/* Block header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full border border-border bg-surface-elevated/80 px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] text-text-muted">
              {lineage.category}
            </span>
            {replacedCount > 0 && (
              <span className="text-[11px] text-text-muted">
                {replacedCount} version{replacedCount > 1 ? "s" : ""} replaced
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold tracking-tight text-text-primary">{lineage.topic}</h3>
        </div>
        <div className="min-w-0 text-left sm:max-w-[45%] sm:text-right">
          <p className="text-[10px] text-text-muted">Currently</p>
          <p className="text-sm font-medium text-brand-primary-hover">{currentEntry.label}</p>
        </div>
      </div>

      {/* Timeline entries */}
      <div>
        {lineage.entries.map((entry, i) => (
          <TimelineEntry
            key={`${lineage.id}-${i}`}
            entry={entry}
            isLast={i === lineage.entries.length - 1}
            onClick={() => onSelectDetail(lineage.id)}
          />
        ))}
      </div>
    </article>
  )
}

// ─── Conflict card ────────────────────────────────────────────────────────────

function ConflictCard({ conflict }: { conflict: ConflictDecision }) {
  return (
    <div className="surface-card card-accent-warning relative overflow-hidden p-5">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-warning/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-warning/10 ring-1 ring-inset ring-warning/20">
              <AlertTriangle className="size-4 text-warning" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-warning/80">Conflict</p>
              <h3 className="text-sm font-semibold text-foreground">{conflict.topic}</h3>
            </div>
          </div>
          <Badge variant="conflict">
            <span className="size-1 rounded-full bg-warning" />
            CONFLICT
          </Badge>
        </div>

        {/* Two sources */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[conflict.sourceA, conflict.sourceB].map((src, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/60 p-3.5"
            >
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Source {i === 0 ? "A" : "B"}
              </p>
              <p className="mb-2 text-xs font-medium text-foreground">{src.label}</p>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="size-3 shrink-0" />
                <span className="text-[10px]">{src.source}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Warning message */}
        <div className="mb-4 rounded-xl border border-warning/15 bg-warning/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed text-warning/90">
              <span className="font-semibold">StreamMind found two valid sources</span> and cannot determine which
              decision is current. Human review required — StreamMind will not hallucinate a resolution.
            </p>
          </div>
        </div>

        <Button
          variant="warning"
          size="sm"
          className="w-full justify-center gap-2"
        >
          <AlertTriangle className="size-3.5" />
          Resolve Conflict
        </Button>
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  detail,
  onClose,
}: {
  detail: DecisionDetail
  onClose: () => void
}) {
  const actionStatusIcon = {
    done: <CheckCircle2 className="size-3.5 text-success" />,
    pending: <Clock className="size-3.5 text-accent-purple" />,
    waiting: <Clock className="size-3.5 text-muted-foreground/50" />,
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-background-secondary shadow-xl animate-slide-in-right"
      aria-label="Decision detail panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Decision Detail
          </p>
          <h2 className="text-sm font-semibold text-foreground">{detail.topic}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Current / Previous */}
        <div className="space-y-3">
          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/[0.06] p-4">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-primary-hover">
              Current Decision
            </p>
            <p className="text-sm font-medium text-text-primary">{detail.current.label}</p>
            {detail.current.reason && (
              <p className="mt-1 text-xs text-text-muted">{detail.current.reason}</p>
            )}
          </div>

          {detail.previous && (
            <div className="surface-card rounded-xl border border-border bg-surface-elevated/50 p-4 opacity-70">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
                Previous Decision
              </p>
              <p className="text-sm font-medium text-text-muted line-through decoration-text-muted/40">
                {detail.previous.label}
              </p>
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="space-y-2.5">
          {[
            { label: "Reason for Change", value: detail.current.reason ?? "Not specified" },
            { label: "Effective Date", value: detail.current.date },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Source lineage */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Source Lineage
          </p>
          <div className="space-y-2">
            {detail.previous && (
              <>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/40 px-4 py-3">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{detail.previous.source}</p>
                    <p className="text-[10px] text-muted-foreground/60">{detail.previous.dateShort}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="h-2 w-px bg-border" />
                    <ArrowDown className="size-3 text-muted-foreground/40" />
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2.5 rounded-xl border border-brand-primary/20 bg-brand-primary/[0.06] px-4 py-3">
              <FileText className="size-3.5 shrink-0 text-brand-primary-hover" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary">{detail.current.source}</p>
                <p className="text-[10px] text-brand-primary/70">{detail.current.dateShort}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card/40 p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Related People
            </p>
            <div className="space-y-1.5">
              {detail.relatedPeople.map((p) => (
                <div key={p} className="flex items-center gap-1.5">
                  <User className="size-3 shrink-0 text-muted-foreground/50" />
                  <span className="text-[11px] text-foreground/80">{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Related Project
            </p>
            <div className="flex items-start gap-1.5">
              <FolderOpen className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
              <span className="text-[11px] text-foreground/80">{detail.relatedProject}</span>
            </div>
          </div>
        </div>

        {/* Action history */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Action History
          </p>
          <div className="space-y-2">
            {detail.actionHistory.map((action, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-2.5",
                  action.status === "done"
                    ? "border-success/15 bg-success/[0.04]"
                    : action.status === "pending"
                      ? "border-brand-secondary/15 bg-brand-secondary/[0.04]"
                      : "border-border bg-surface/40 opacity-50",
                )}
              >
                {actionStatusIcon[action.status]}
                <span
                  className={cn(
                    "text-xs",
                    action.status === "done"
                      ? "text-text-secondary"
                      : action.status === "pending"
                        ? "text-brand-secondary/80"
                        : "text-text-muted",
                  )}
                >
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel footer actions */}
      <div className="flex gap-2 border-t border-border px-6 py-4">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
          <Eye className="size-3.5" />
          View Evidence
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
          <Sparkles className="size-3.5" />
          Ask StreamMind
        </Button>
        <Button variant="default" size="sm" className="flex-1 gap-1.5 text-xs">
          <Zap className="size-3.5" />
          Create Action
        </Button>
      </div>
    </aside>
  )
}

// ─── Main page component ─────────────────────────────────────────────────────

export function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<DecisionDetail | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [decRes, confRes] = await Promise.all([
        api.getDecisions(),
        api.getConflicts('open')
      ])
      setDecisions(decRes.decisions || [])
      setConflicts(confRes.conflicts || [])
      setError(false)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function openDetail(id: string) {
    // Find the decision to get its ID
    const decision = decisions.find(d => d.id === id || d.topic === id)
    if (!decision) return
    try {
      const lineageData = await api.getDecisionById(decision.id)
      
      const activeLineageItem = lineageData.lineage.find(l => l.status === "active") || lineageData.lineage[0] || {}
      const currentEntry = { ...lineageData.current, ...activeLineageItem }
      const previousEntries = lineageData.lineage.filter(l => l.status === "replaced")
      const previousEntry = previousEntries.length > 0 ? previousEntries[previousEntries.length - 1] : undefined

      setSelectedDetail({
        id: lineageData.id,
        topic: lineageData.topic,
        current: {
          date: currentEntry.source_date || currentEntry.created_at || "Unknown Date",
          dateShort: (currentEntry.source_date || "Unknown").substring(0, 6).toUpperCase(),
          label: currentEntry.value || "Unknown",
          source: currentEntry.source || "Unknown Source",
          status: "CURRENT",
          reason: currentEntry.reason || undefined
        },
        previous: previousEntry ? {
          date: previousEntry.source_date || previousEntry.created_at || "Unknown Date",
          dateShort: (previousEntry.source_date || "Unknown").substring(0, 6).toUpperCase(),
          label: previousEntry.value,
          source: previousEntry.source || "Unknown Source",
          status: "REPLACED",
          reason: previousEntry.reason || undefined
        } : undefined,
        relatedPeople: [],
        relatedProject: "StreamMind AI",
        actionHistory: []
      })
    } catch (err) {
      console.error("Failed to load decision detail", err)
    }
  }

  function closeDetail() {
    setSelectedDetail(null)
  }

  // Calculate stats
  const activeCount = decisions.filter(d => d.status === "active").length
  const replacedCount = decisions.filter(d => d.status === "replaced").length
  const conflictCount = conflicts.length

  // Build lineages for timeline view (group by topic)
  const grouped = decisions.reduce((acc, doc) => {
    const key = doc.topic;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, DecisionRecord[]>);

  const realLineages: DecisionLineage[] = Object.keys(grouped).map(topic => {
    const group = grouped[topic]
    // Sort by created_at ascending to build timeline
    group.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    
    return {
      id: group[group.length - 1].id,
      topic: topic,
      category: "DECISION",
      entries: group.map((d) => ({
        date: d.source_date || (d.created_at ? new Date(d.created_at).toLocaleDateString() : "Unknown Date"),
        dateShort: d.source_date ? d.source_date.substring(0, 6).toUpperCase() : (d.created_at ? new Date(d.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}).toUpperCase() : "DATE"),
        label: d.value,
        source: d.source_document || "Unknown",
        status: d.status === "active" ? "CURRENT" : d.status === "replaced" ? "REPLACED" : "CONFLICT",
        reason: d.reason || undefined
      }))
    }
  })

  // We only show lineages that have at least one active or replaced decision (meaning they are real)
  const displayLineages = realLineages.filter(l => l.entries.some(e => e.status === "CURRENT" || e.status === "REPLACED"))

  return (
    <>
      <div className="page-container animate-page-enter">
        {/* Page header */}
        <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/[0.07] px-3 py-1 text-[11px] font-medium text-brand-primary-hover">
          <span className="size-1.5 rounded-full bg-brand-primary" />
          Decision Lineage
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Decision{" "}
          <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
            Timeline
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-text-muted">
          Track how project decisions evolve, what changed, why it changed, and which source is authoritative.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
            Could not load project decisions.
            <Button variant="outline" size="sm" className="ml-4" onClick={fetchData}>Retry</Button>
          </div>
        )}

        {!error && !loading && (
          <>
            {/* Stats cards */}
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Active Decisions", value: activeCount, accent: "cyan" as const },
                { label: "Replaced Decisions", value: replacedCount, accent: "purple" as const },
                { label: "Conflicts Detected", value: conflictCount, accent: "conflict" as const },
                { label: "Total Decisions", value: decisions.length, accent: "blue" as const }
              ].map(({ value, label, accent }, statIdx) => {
                const a = accentMap[accent]
                const Icon = label === "Total Decisions" ? Link2 : statIconMap[label as keyof typeof statIconMap]
                return (
                  <div
                    key={label}
                    className={cn(
                      "surface-card metric-card group relative overflow-hidden p-5 ring-1 ring-transparent transition-all duration-220 animate-card-enter",
                      accent === "cyan" || accent === "blue" ? "card-accent-gold current-decision" :
                        accent === "purple" ? "card-accent-gold" :
                          accent === "conflict" ? "card-accent-warning" : "card-accent-brand",
                      `stagger-${statIdx + 1}`,
                    )}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                        a.glow,
                      )}
                    />
                    <div className={cn("mb-4 flex size-10 items-center justify-center rounded-xl ring-1 ring-inset", a.icon)}>
                      <Icon className="size-5" />
                    </div>
                    <p className="text-3xl font-semibold tracking-tight text-text-primary">{value}</p>
                    <p className="mt-1 text-sm text-text-muted">{label}</p>
                  </div>
                )
              })}
            </div>

            {/* Decision Lineage section */}
            <section aria-labelledby="lineage-heading" className="mt-12">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2
                    id="lineage-heading"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Decision Lineage
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    Click any decision entry to view its full detail
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">{displayLineages.length} topics tracked</span>
              </div>

              {displayLineages.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/30 text-center">
                  <p className="text-sm font-medium text-foreground">No project decisions yet.</p>
                  <p className="mt-1 text-xs text-text-muted">Index project documents and process decisions to build Decision Memory.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {displayLineages.map((lineage) => (
                    <LineageBlock key={lineage.id} lineage={lineage} onSelectDetail={openDetail} />
                  ))}
                </div>
              )}
            </section>

            {/* Conflicts section */}
            <section aria-labelledby="conflicts-heading" className="mt-12">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2
                    id="conflicts-heading"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Conflicts Detected
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    StreamMind does not resolve ambiguity automatically — human review required
                  </p>
                </div>
                <Badge variant="conflict">
                  <span className="size-1 rounded-full bg-destructive" />
                  {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {conflicts.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-border bg-background/30 text-center text-xs text-text-muted">
                  No open conflicts detected.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {conflicts.map((conflict) => (
                    <ConflictCard key={conflict.id} conflict={{
                      id: conflict.id,
                      topic: conflict.topic,
                      sourceA: { label: conflict.existing_value || "Existing", source: "Existing Knowledge" },
                      sourceB: { label: conflict.candidate_value || "Candidate", source: conflict.source_document || "New Source" }
                    }} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {/* Detail overlay backdrop */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={closeDetail}
          aria-hidden="true"
        />
      )}

      {/* Detail panel */}
      {selectedDetail && (
        <DetailPanel detail={selectedDetail} onClose={closeDetail} />
      )}
    </>
  )
}
