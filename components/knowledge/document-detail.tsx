import { ArrowDown, ArrowRight, Check, ChevronDown, FileText, GitBranch, Link2, ListChecks, Quote, ShieldCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { knowledgeDocuments, type KnowledgeDocument } from "@/lib/knowledge-data"
import { cn } from "@/lib/utils"

function HighlightedExcerpt({ text, highlights }: { text: string; highlights: string[] }) {
  const segments: { text: string; highlighted: boolean }[] = []
  let cursor = 0
  while (cursor < text.length) {
    const next = highlights
      .map((phrase) => ({ phrase, index: text.indexOf(phrase, cursor) }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index)[0]
    if (!next) {
      segments.push({ text: text.slice(cursor), highlighted: false })
      break
    }
    if (next.index > cursor) segments.push({ text: text.slice(cursor, next.index), highlighted: false })
    segments.push({ text: next.phrase, highlighted: true })
    cursor = next.index + next.phrase.length
  }
  return segments.map((segment, index) => segment.highlighted
    ? <mark key={index} className="rounded bg-brand-primary/10 px-1 py-0.5 text-brand-primary-hover">{segment.text}</mark>
    : <span key={index}>{segment.text}</span>)
}

const sectionHeading = "mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted"

export function DocumentDetail({ document, onSelectSource }: { document: any; onSelectSource: (document: any) => void }) {
  if (!document) return null

  const dateStr = document.created_at ? new Date(document.created_at).toLocaleDateString() : "Unknown date"

  return (
    <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
      <SheetHeader className="shrink-0 gap-3 border-b p-6 pr-12">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-primary-hover">
          <FileText aria-hidden="true" className="size-3.5" />Source intelligence
        </div>
        <SheetTitle className="break-words">{document.original_name}</SheetTitle>
        <SheetDescription>Every insight, connected to its evidence.</SheetDescription>
      </SheetHeader>

      <div key={document.id} className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto overscroll-contain p-6" data-knowledge-detail-scroll>
        <section aria-labelledby="document-info-heading">
          <h3 id="document-info-heading" className={sectionHeading}>Document info</h3>
          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-background/30 p-4">
            <div><dt className="mb-2 text-[11px] text-text-muted">Added</dt><dd className="text-xs font-medium">{dateStr}</dd></div>
            <div><dt className="mb-2 text-[11px] text-text-muted">Status</dt><dd><Badge variant={document.status === "indexed" ? "current" : "outline"}>{document.status === "indexed" && <Check aria-hidden="true" data-icon="inline-start" />}{document.status}</Badge></dd></div>
            <div><dt className="mb-2 text-[11px] text-text-muted">Source ID</dt><dd className="font-mono text-xs text-foreground/85 truncate" title={document.id}>{document.id.split('-')[0]}...</dd></div>
          </dl>
        </section>

        <section aria-labelledby="entities-heading">
          <h3 id="entities-heading" className={sectionHeading}><Users aria-hidden="true" className="size-3.5" />Extracted entities</h3>
          {document.entities && document.entities.length > 0 ? (
            <dl className="flex flex-col gap-3 text-xs">
              {document.entities.map((e: any, i: number) => (
                <div key={i} className="flex flex-col gap-1 rounded-md border border-border/50 p-2">
                  <span className="font-semibold text-text-primary">{e.name} <Badge variant="outline" className="ml-2 font-normal">{e.entity_type}</Badge></span>
                  {e.description && <span className="text-text-muted">{e.description}</span>}
                </div>
              ))}
            </dl>
          ) : (
            <div className="text-xs text-text-muted italic">No entities detected</div>
          )}
        </section>

        <section aria-labelledby="facts-heading">
          <div className="flex items-start justify-between gap-3">
            <h3 id="facts-heading" className={sectionHeading}><ListChecks aria-hidden="true" className="size-3.5" />Extracted facts</h3>
          </div>
          {document.facts && document.facts.length > 0 ? (
            <ul className="flex flex-col gap-2 text-xs">
              {document.facts.map((f: any, i: number) => (
                <li key={i} className="rounded-md border border-border/50 p-2 text-text-primary">
                  {f.content}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-3 text-xs text-text-muted italic">
              No facts detected
            </ul>
          )}
        </section>
        
        <section aria-labelledby="actions-heading">
          <div className="flex items-start justify-between gap-3">
            <h3 id="actions-heading" className={sectionHeading}><ShieldCheck aria-hidden="true" className="size-3.5" />Action Items</h3>
          </div>
          {document.actions && document.actions.length > 0 ? (
            <ul className="flex flex-col gap-3 text-xs">
              {document.actions.map((a: any, i: number) => (
                <li key={i} className="flex flex-col gap-1 rounded-md border border-border/50 p-2">
                  <span className="font-semibold text-text-primary">{a.title}</span>
                  <span className="text-text-muted">{a.description}</span>
                  <Badge variant={a.status === "pending" ? "default" : "outline"} className="w-fit">{a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-text-muted italic">No action items detected</div>
          )}
        </section>

        <section aria-labelledby="decisions-heading">
          <div className="flex items-start justify-between gap-3">
            <h3 id="decisions-heading" className={sectionHeading}><GitBranch aria-hidden="true" className="size-3.5" />Detected decisions</h3>
          </div>
          {document.decisions && document.decisions.length > 0 ? (
            <ul className="flex flex-col gap-3 text-xs">
              {document.decisions.map((d: any, i: number) => (
                <li key={i} className="flex flex-col gap-1 rounded-md border border-border/50 p-2">
                  <span className="font-semibold text-text-primary">{d.topic}</span>
                  <span className="text-text-muted">{d.value}</span>
                  <Badge variant={d.status === "active" ? "current" : "outline"} className="w-fit">{d.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-text-muted italic">No decisions detected.</div>
          )}
        </section>

        <section aria-labelledby="source-preview-heading">
          <h3 id="source-preview-heading" className={sectionHeading}><Quote aria-hidden="true" className="size-3.5" />Source preview</h3>
          <blockquote className="rounded-r-xl border-l-2 border-brand-primary/20 bg-background/40 px-4 py-4 text-xs leading-7 text-foreground/80">
            {document.preview_text ? (
              <span className="whitespace-pre-wrap">{document.preview_text}</span>
            ) : (
              <span className="italic">Preview unavailable.</span>
            )}
          </blockquote>
        </section>
      </div>
    </SheetContent>
  )
}
