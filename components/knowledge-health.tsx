import { Brain, FileText, Link2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export function KnowledgeHealth({ summary }: { summary?: any }) {
  const metrics = [
    { label: "Documents Indexed", value: summary ? summary.documents_indexed.toString() : "0", icon: FileText },
    { label: "Total Knowledge Chunks", value: summary ? summary.total_chunks.toString() : "0", icon: Brain },
    { label: "Decision Links", value: summary ? summary.active_decisions.toString() : "0", icon: Link2 },
    { label: "Conflicts Detected", value: summary ? summary.open_conflicts.toString() : "0", icon: TriangleAlert },
  ]

  return (
    <section aria-labelledby="knowledge-health-heading" className="mt-10">
      <h2
        id="knowledge-health-heading"
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
      >
        Project Knowledge Health
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface-card rounded-xl border border-border bg-surface/80 p-4">
            <dt className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
              {label}
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0",
                  label === "Conflicts Detected" && "text-warning/80",
                )}
              />
            </dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
