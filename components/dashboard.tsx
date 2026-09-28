"use client"
import { CountUp } from "@/components/workspace-effects"
import { FileText, GitBranch, Clock, TriangleAlert, type LucideIcon } from "lucide-react"
import { DecisionChanges } from "@/components/decision-changes"
import { KnowledgeHealth } from "@/components/knowledge-health"
import { NeedsAttention } from "@/components/needs-attention"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"

type Stat = {
  value: string
  label: string
  icon: LucideIcon
  accent: "brand" | "gold" | "success" | "warning"
}

const stats: Stat[] = [
  { value: "24", label: "Documents Indexed",  icon: FileText,      accent: "brand" },
  { value: "12", label: "Active Decisions",   icon: GitBranch,     accent: "success" },
  { value: "2",  label: "Pending Actions",    icon: Clock,         accent: "gold" },
  { value: "2",  label: "Conflicts Detected", icon: TriangleAlert, accent: "warning" },
]

const accentMap = {
  brand: {
    text: "text-brand-primary-hover",
    ring: "group-hover:ring-brand-primary/30",
    glow: "from-brand-primary/15",
    icon: "bg-brand-primary/10 text-brand-primary-hover ring-brand-primary/20",
    border: "group-hover:border-brand-primary/25",
  },
  gold: {
    text: "text-brand-secondary",
    ring: "group-hover:ring-brand-secondary/30",
    glow: "from-brand-secondary/12",
    icon: "bg-brand-secondary/10 text-brand-secondary ring-brand-secondary/20",
    border: "group-hover:border-brand-secondary/25",
  },
  success: {
    text: "text-success",
    ring: "group-hover:ring-success/25",
    glow: "from-success/10",
    icon: "bg-success/10 text-success ring-success/20",
    border: "group-hover:border-success/20",
  },
  warning: {
    text: "text-warning",
    ring: "group-hover:ring-warning/25",
    glow: "from-warning/12",
    icon: "bg-warning/10 text-warning ring-warning/20",
    border: "group-hover:border-warning/20",
  },
}

export function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true)
        const data = await api.getMemorySummary()
        setSummary(data)
      } catch (error) {
        console.error("Failed to fetch memory summary:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  if (loading) {
    return (
      <div className="page-container animate-page-enter">
        <header className="overview-hero">
          <div className="overview-copy">
            <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/[0.07] px-3 py-1 text-[11px] font-medium text-brand-primary-hover">
              <span className="size-1.5 rounded-full bg-brand-primary" />
              Overview
            </div>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
              Your project intelligence,{" "}
              <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
                under your control.
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-text-muted">
              A private, local-first workspace where your team&apos;s knowledge, decisions and actions stay
              on your device — searchable, auditable and always yours.
            </p>
          </div>
        </header>

        {/* Skeleton Stat cards */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface-card p-5 border border-border/50 animate-pulse rounded-2xl bg-surface/50 h-32"></div>
          ))}
        </div>
      </div>
    )
  }

  const activeStats: Stat[] = [
    { value: summary ? summary.documents_indexed.toString() : "0", label: "Documents Indexed",  icon: FileText,      accent: "brand" },
    { value: summary ? summary.active_decisions.toString() : "0", label: "Active Decisions",   icon: GitBranch,     accent: "success" },
    { value: summary ? summary.pending_actions.toString() : "0",  label: "Pending Actions",    icon: Clock,         accent: "gold" },
    { value: summary ? summary.open_conflicts.toString() : "0",  label: "Conflicts Detected", icon: TriangleAlert, accent: "warning" },
  ]

  return (
    <div className="page-container animate-page-enter">
      <header className="overview-hero">
      <div className="overview-copy">
      {/* Section pill */}
      <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/[0.07] px-3 py-1 text-[11px] font-medium text-brand-primary-hover">
        <span className="size-1.5 rounded-full bg-brand-primary" />
        Overview
      </div>

      <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        Your project intelligence,{" "}
        <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
          under your control.
        </span>
      </h1>
      <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-text-muted">
        A private, local-first workspace where your team&apos;s knowledge, decisions and actions stay
        on your device — searchable, auditable and always yours.
      </p>

      </div>
      </header>

      {/* Stat cards — fill available width, responsive grid */}
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {activeStats.map(({ value, label, icon: Icon, accent }, idx) => {
          const a = accentMap[accent]
          return (
            <div
              key={label}
              className={cn(
                "surface-card metric-card group relative overflow-hidden p-5 ring-1 ring-transparent transition-all duration-220 animate-card-enter",
                accent === "brand" ? "card-accent-brand" :
                accent === "gold"  ? "card-accent-gold"  :
                accent === "success" ? "card-accent-success" :
                "card-accent-warning",
                a.ring,
                `stagger-${idx + 1}`,
              )}
            >
              {/* Corner glow on hover */}
              <div
                className={cn(
                  "pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                  a.glow,
                )}
              />
              <div
                className={cn(
                  "mb-4 flex size-10 items-center justify-center rounded-xl ring-1 ring-inset",
                  a.icon,
                )}
              >
                <Icon className="size-5" />
              </div>
              <p className={cn("text-3xl font-semibold tracking-tight animate-count-up", `stagger-${idx + 1}`)}>
                <CountUp value={Number(value)} />
              </p>
              <p className="mt-1 text-sm text-text-muted">{label}</p>
            </div>
          )
        })}
      </div>

      <DecisionChanges />
      <KnowledgeHealth />
      <NeedsAttention />
    </div>
  )
}
