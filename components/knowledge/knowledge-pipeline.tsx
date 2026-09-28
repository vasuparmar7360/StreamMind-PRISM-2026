import { ArrowRight, FileText, GitBranch, Link2, ListChecks, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  { label: "File", icon: FileText, color: "text-text-muted", surface: "bg-muted/60" },
  { label: "Extracted facts", icon: ListChecks, color: "text-brand-primary-hover", surface: "bg-brand-primary/10" },
  { label: "Entities", icon: Users, color: "text-brand-primary-hover", surface: "bg-brand-primary/10" },
  { label: "Decisions", icon: GitBranch, color: "text-brand-secondary", surface: "bg-brand-secondary/10" },
  { label: "Related sources", icon: Link2, color: "text-brand-primary-hover", surface: "bg-brand-primary/10" },
]

export function KnowledgePipeline() {
  return (
    <section aria-label="From files to connected project knowledge" className="signal-flow surface-card knowledge-pipeline rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <ol className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4">
        {steps.map(({ label, icon: Icon, color, surface }, index) => (
          <li key={label} className="flex items-center gap-3">
            {index > 0 && <ArrowRight aria-hidden="true" className="mr-1 hidden size-3.5 text-text-muted/40 lg:block" />}
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", color, surface)}>
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="text-xs font-medium text-foreground/80">{label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
