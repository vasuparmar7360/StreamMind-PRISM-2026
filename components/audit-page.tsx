"use client"

import { useState } from "react"
import {
  History,
  ShieldCheck,
  Search,
  Calendar,
  Table as TableIcon,
  GitBranch,
  ArrowRight,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  Terminal,
  Hash,
  X,
  Link2,
  Lock,
  Layers,
  Check,
  AlertTriangle,
  ArrowDown,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AuditRecord,
  type StatusCategory,
} from "@/lib/audit-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type AuditEventRecord } from "@/lib/api"
import { useEffect } from "react"

export function AuditPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<string>("All")
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table")
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([])
  
  const [stats, setStats] = useState({ totalEvents: 0, approvals: 0, rejections: 0, memoryUpdates: 0 })

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true)
        const res = await api.getAuditEvents({ limit: 100 })
        const counts = { totalEvents: 0, approvals: 0, rejections: 0, memoryUpdates: 0 }
        
        const mapped: AuditRecord[] = (res.events || []).map((ev: AuditEventRecord, i) => {
          let category: StatusCategory = "DECISION_UPDATE";
          if (ev.event_type.toLowerCase().includes("approve")) {
            category = "APPROVED";
            counts.approvals++;
          }
          else if (ev.event_type.toLowerCase().includes("reject")) {
            category = "REJECTED";
            counts.rejections++;
          }
          else if (ev.event_type.toLowerCase().includes("conflict")) {
            category = "CONFLICT";
          }
          else if (ev.event_type.toLowerCase().includes("pending")) {
            category = "PENDING";
          }
          
          if (ev.event_type.toLowerCase().includes("memory")) counts.memoryUpdates++;
          
          counts.totalEvents++;

          return {
            id: ev.id,
            time: new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date(ev.created_at).toLocaleDateString(),
            timestamp: new Date(ev.created_at).toLocaleString(),
            event: (ev.title || ev.event_type) as any,
            actor: ev.actor_type === 'human' ? 'Human User' : 'System',
            sourceDisplay: ev.entity_type,
            actionTitle: ev.title,
            relatedDecision: ev.description,
            statusCategory: category,
            payload: ev.metadata_json,
            timelineOrder: i,
            sources: ev.source_document_id ? [{ source: ev.source_document_id.substring(0,8), date: new Date(ev.created_at).toLocaleDateString(), note: "" }] : [],
            approvalDisplay: category === "APPROVED" ? "Approved by User" : category === "REJECTED" ? "Rejected by User" : "System",
            resultDisplay: ev.metadata_json?.result ? "Completed" : "Logged",
            reason: ev.description,
            approvalTrace: {
              aiProposed: true,
              policyCheck: true,
              userReview: category === "APPROVED" ? "Approved" : category === "REJECTED" ? "Rejected" : "System",
              execution: category === "APPROVED" ? "Completed" : category === "REJECTED" ? "Not Executed" : "Indexed"
            },
            tool: ev.entity_type,
            resultDetails: "Successfully recorded",
            recordHash: ev.id,
            prevRecordId: i > 0 && res.events ? res.events[i-1].id : "root",
          }
        })
        setAuditRecords(mapped)
        setStats(counts)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [])

  // Filter records
  const filteredRecords = auditRecords.filter((record) => {
    // Search query matching
    const matchesSearch =
      searchQuery.trim() === "" ||
      record.actionTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.relatedDecision.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.sourceDisplay.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    // Category filter
    if (selectedFilter === "All") return true
    if (selectedFilter === "Decision Updates") {
      return record.event === "Decision Updated" || record.event === "Source Indexed"
    }
    if (selectedFilter === "Approved Actions") {
      return record.statusCategory === "APPROVED"
    }
    if (selectedFilter === "Rejected Actions") {
      return record.statusCategory === "REJECTED"
    }
    if (selectedFilter === "Memory Changes") {
      return (
        record.event === "Memory Updated" ||
        record.event === "Decision Updated" ||
        record.event === "Source Indexed"
      )
    }
    if (selectedFilter === "Conflicts") {
      return record.statusCategory === "CONFLICT"
    }
    return true
  })

  // Timeline events sorted
  const timelineSteps = auditRecords
    .filter((r) => r.timelineOrder !== undefined)
    .sort((a, b) => (a.timelineOrder ?? 0) - (b.timelineOrder ?? 0))

  const getStatusBadge = (category: StatusCategory, text?: string) => {
    switch (category) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
            <Check className="size-2.5" />
            {text ?? "APPROVED"}
          </span>
        )
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
            <X className="size-2.5" />
            {text ?? "REJECTED"}
          </span>
        )
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-secondary/30 bg-brand-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
            <Clock className="size-2.5" />
            {text ?? "PENDING"}
          </span>
        )
      case "DECISION_UPDATE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary-hover">
            <Sparkles className="size-2.5" />
            {text ?? "DECISION UPDATE"}
          </span>
        )
      case "CONFLICT":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            <AlertTriangle className="size-2.5" />
            {text ?? "CONFLICT"}
          </span>
        )
    }
  }

  return (
    <div className="page-container animate-page-enter">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-medium text-text-muted">
            <span className="size-1.5 rounded-full bg-brand-primary" />
            Immutable Audit Trail
          </div>
          <Badge
            variant="outline"
            className="border-brand-primary/30 bg-brand-primary/[0.08] text-brand-primary-hover font-medium text-[11px] gap-1.5 py-1 px-3"
          >
            <ShieldCheck className="size-3.5" />
            Tamper-Aware History
          </Badge>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Audit{" "}
          <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
            Trail
          </span>
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-text-muted">
          Every important memory, decision and AI action remains traceable.
        </p>

        {/* ─── COGNITIVE LINEAGE FLOW BANNER ─────────────────────────────────── */}
        <div className="signal-flow mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/80 p-2.5 text-[11px] text-text-muted">
          <span className="font-semibold text-text-primary">SOURCE</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-brand-primary-hover">DECISION</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-text-primary">AI PROPOSAL</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-brand-secondary">POLICY CHECK</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-success">USER APPROVAL</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-text-primary">EXECUTION</span>
          <ArrowRight className="size-3 text-text-muted/40" />
          <span className="font-semibold text-brand-primary-hover">RESULT</span>
        </div>
      </div>

      {/* ─── TOP SUMMARY CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Records */}
        <div className="surface-card metric-card group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 ring-1 ring-transparent transition-all duration-300 hover:ring-border/60">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-white/[0.04] text-text-muted ring-1 ring-inset ring-white/10">
            <History className="size-5" />
          </div>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">
            {stats.totalEvents}
          </p>
          <p className="mt-1 text-sm text-text-muted">Total Records</p>
        </div>

        {/* Executed Actions */}
        <div className="surface-card metric-card card-accent-success group relative overflow-hidden rounded-2xl border border-success/20 bg-surface p-5 ring-1 ring-transparent transition-all duration-300 hover:ring-success/30">
          <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-success/15 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-success/10 text-success ring-1 ring-inset ring-success/20">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">
            {stats.approvals}
          </p>
          <p className="mt-1 text-sm text-text-muted">Executed Actions</p>
        </div>

        {/* Rejected Actions */}
        <div className="surface-card metric-card card-accent-danger group relative overflow-hidden rounded-2xl border border-danger/20 bg-surface p-5 ring-1 ring-transparent transition-all duration-300 hover:ring-danger/30">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-danger/10 text-danger ring-1 ring-inset ring-danger/20">
            <XCircle className="size-5" />
          </div>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">
            {stats.rejections}
          </p>
          <p className="mt-1 text-sm text-text-muted">Rejected Actions</p>
        </div>

        {/* Decision Updates */}
        <div className="surface-card metric-card group relative overflow-hidden rounded-2xl border border-brand-primary/20 bg-surface p-5 ring-1 ring-transparent transition-all duration-300 hover:ring-brand-primary/30">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary-hover ring-1 ring-inset ring-brand-primary/20">
            <Zap className="size-5" />
          </div>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">
            {stats.memoryUpdates}
          </p>
          <p className="mt-1 text-sm text-text-muted">Decision Updates</p>
        </div>
      </div>

      {/* ─── FILTER / SEARCH BAR ───────────────────────────────────────────── */}
      <div className="mt-10 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit records by ID, decision, action or source..."
              className="w-full rounded-xl border border-border bg-surface/90 pl-10 pr-4 py-2 text-xs text-foreground placeholder:text-text-muted outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-brand-primary/30"
            />
          </div>

          {/* Controls: Date range & View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface/90 px-3 py-1.5 text-xs text-text-muted">
              <Calendar className="size-3.5" />
              <span>Last 7 Days</span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-border bg-surface/90 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "table"
                    ? "bg-brand-primary/15 text-brand-primary-hover"
                    : "text-text-muted hover:text-foreground",
                )}
              >
                <TableIcon className="size-3.5" />
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "timeline"
                    ? "bg-brand-primary/15 text-brand-primary-hover"
                    : "text-text-muted hover:text-foreground",
                )}
              >
                <GitBranch className="size-3.5" />
                Timeline View
              </button>
            </div>
          </div>
        </div>

        {/* Filter Categories Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            "All",
            "Decision Updates",
            "Approved Actions",
            "Rejected Actions",
            "Memory Changes",
            "Conflicts",
          ].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs transition-all cursor-pointer",
                selectedFilter === filter
                  ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary-hover font-medium"
                  : "border-border bg-surface/70 text-text-muted hover:border-border hover:text-foreground",
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MAIN CONTENT: TABLE VIEW OR TIMELINE VIEW ──────────────────────── */}
      {viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-elevated/60 text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Time</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Event</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Related Decision</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Source</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Approval</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
                    >
                      {/* Time + ID */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-text-primary">{record.time}</span>
                        <span className="block font-mono text-[10px] text-text-muted">
                          {record.id}
                        </span>
                      </td>

                      {/* Event */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(record.statusCategory, record.event)}
                        </div>
                      </td>

                      {/* Related Decision */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-text-primary">
                          {record.relatedDecision}
                        </span>
                        {record.actionTitle && (
                          <span className="block text-[11px] text-text-muted truncate max-w-[200px]">
                            {record.actionTitle}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-5 py-3.5 text-text-muted">
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3 text-brand-primary-hover shrink-0" />
                          <span className="font-mono text-[11px] truncate max-w-[180px]">
                            {record.sourceDisplay}
                          </span>
                        </div>
                      </td>

                      {/* Approval */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            record.approvalDisplay.includes("Approved")
                              ? "text-success"
                              : record.approvalDisplay.includes("Rejected")
                                ? "text-danger"
                                : record.approvalDisplay.includes("Waiting")
                                  ? "text-brand-secondary"
                                  : "text-text-muted",
                          )}
                        >
                          {record.approvalDisplay}
                        </span>
                      </td>

                      {/* Result */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-text-primary">
                            {record.resultDisplay}
                          </span>
                          <ArrowRight className="size-3 text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                      No audit records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TIMELINE VIEW */
        <div className="surface-card mt-8 rounded-3xl border border-border bg-surface/80 p-8">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Chronological Decision & Action Lineage</h3>
              <p className="text-xs text-text-muted">
                How Project_Plan.pdf evolved through meeting updates into authorized execution
              </p>
            </div>
            <span className="text-[11px] text-text-muted">6 Linked Events</span>
          </div>

          <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-brand-primary before:via-accent-purple before:to-success">
            {timelineSteps.map((step, idx) => (
              <div key={step.id} className="relative flex items-start gap-4">
                {/* Node icon / indicator */}
                <div
                  className={cn(
                    "absolute -left-6 top-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background",
                    idx === timelineSteps.length - 1
                      ? "border-success text-success shadow-none"
                      : idx === 0
                        ? "border-accent-cyan text-brand-primary-hover"
                        : "border-accent-purple text-brand-secondary",
                  )}
                >
                  <span className="text-[9px] font-bold">{idx + 1}</span>
                </div>

                {/* Timeline Card */}
                <button
                  type="button"
                  onClick={() => setSelectedRecord(step)}
                  className="surface-card flex-1 rounded-2xl border border-border bg-surface/90 p-4 text-left transition-all hover:border-brand-primary/40 hover:bg-card/90 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[10px] text-text-muted">
                      {step.time} · {step.id}
                    </span>
                    {getStatusBadge(step.statusCategory, step.event)}
                  </div>

                  <h4 className="text-sm font-semibold text-text-primary">
                    {step.timelineStepTitle ?? step.actionTitle}
                  </h4>

                  <p className="mt-1 text-xs text-text-muted leading-relaxed">
                    {step.reason ?? step.resultDetails}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <FileText className="size-3 text-brand-primary-hover" />
                      <span>{step.sourceDisplay}</span>
                    </div>
                    <span className="text-brand-primary-hover font-medium flex items-center gap-1">
                      Inspect Trace <ArrowRight className="size-3" />
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── AUDIT DETAIL DRAWER / MODAL ─────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedRecord(null)}
            aria-hidden="true"
          />

          {/* Side Panel Drawer */}
          <aside
            className="detail-drawer relative z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-sidebar shadow-2xl overflow-y-auto"
            aria-label="Audit Record Detail"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-sidebar/95 px-6 py-5 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand-primary-hover">
                    AUDIT RECORD
                  </span>
                  <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-primary-hover">
                    {selectedRecord.id}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground mt-0.5">
                  {selectedRecord.actionTitle ?? selectedRecord.event}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 px-6 py-5 space-y-6">
              {/* Event & Decision Overview */}
              <div className="surface-card rounded-2xl border border-border bg-surface/90 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-text-muted">EVENT:</span>
                  <span className="font-semibold text-text-primary">{selectedRecord.event}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-text-muted">TIMESTAMP:</span>
                  <span className="font-mono text-text-primary">{selectedRecord.time}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-text-muted">RELATED DECISION:</span>
                  <span className="font-semibold text-brand-primary-hover">{selectedRecord.relatedDecision}</span>
                </div>
                {selectedRecord.previousValue && (
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-text-muted">PREVIOUS VALUE:</span>
                    <span className="font-medium text-text-muted line-through">
                      {selectedRecord.previousValue}
                    </span>
                  </div>
                )}
                {selectedRecord.currentValue && (
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-text-muted">CURRENT VALUE:</span>
                    <span className="font-semibold text-text-primary">
                      {selectedRecord.currentValue}
                    </span>
                  </div>
                )}
                {selectedRecord.reason && (
                  <div>
                    <span className="text-text-muted block mb-0.5">REASON:</span>
                    <span className="font-medium text-text-primary/90">
                      {selectedRecord.reason}
                    </span>
                  </div>
                )}
              </div>

              {/* SOURCE PROVENANCE */}
              <div>
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Source Provenance
                </p>
                <div className="space-y-2">
                  {selectedRecord.sources.map((src, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface/70 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-text-primary">
                          <FileText className="size-3.5 text-brand-primary-hover" />
                          <span>Source {i + 1}: {src.source}</span>
                        </div>
                        <span className="text-[10px] text-text-muted">{src.date}</span>
                      </div>
                      <p className="mt-1 text-text-muted text-[11px] leading-relaxed">
                        {src.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* APPROVAL TRACE */}
              <div>
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Approval Trace
                </p>
                <div className="rounded-2xl border border-border bg-background/60 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/90">AI Proposed</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                      <Check className="size-3" /> Yes
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/90">Policy Check</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                      <Check className="size-3" /> {selectedRecord.approvalTrace.policyCheckText ?? "Passed"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/90">User Review</span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-semibold",
                        selectedRecord.approvalTrace.userReview === "Approved"
                          ? "text-success"
                          : selectedRecord.approvalTrace.userReview === "Rejected"
                            ? "text-danger"
                            : "text-brand-secondary",
                      )}
                    >
                      {selectedRecord.approvalTrace.userReview === "Approved" && <Check className="size-3" />}
                      {selectedRecord.approvalTrace.userReview === "Rejected" && <X className="size-3" />}
                      {selectedRecord.approvalTrace.userReview}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/90">Execution</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-text-primary">
                      {selectedRecord.approvalTrace.execution}
                    </span>
                  </div>
                </div>
              </div>

              {/* TOOL EXECUTION & PAYLOAD PREVIEW */}
              {selectedRecord.tool && (
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      Tool Execution
                    </p>
                    <span className="font-mono text-[10px] text-brand-secondary">
                      Tool: {selectedRecord.tool}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border bg-background-secondary p-4 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Payload Preview:
                    </p>
                    <pre className="overflow-x-auto font-mono text-[11px] text-success">
                      {JSON.stringify(selectedRecord.payload ?? {}, null, 2)}
                    </pre>
                    {selectedRecord.resultDetails && (
                      <div className="border-t border-border/40 pt-2 text-xs">
                        <span className="text-text-muted">Result: </span>
                        <span className="font-medium text-text-primary">
                          {selectedRecord.resultDetails}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RECORD INTEGRITY (APPEND-ONLY LINKED HISTORY) */}
              <div className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/[0.04] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-brand-secondary">
                    <Hash className="size-3.5" />
                    <span className="text-xs font-semibold">Record Integrity</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded bg-brand-secondary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-secondary">
                    Status: Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div className="rounded-lg border border-border bg-background/60 p-2">
                    <span className="text-[10px] text-text-muted block">Record Hash:</span>
                    <span className="font-mono font-semibold text-text-primary">
                      {selectedRecord.recordHash}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-2">
                    <span className="text-[10px] text-text-muted block">Previous Record:</span>
                    <span className="font-mono font-semibold text-text-primary">
                      {selectedRecord.prevRecordId}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-text-muted leading-relaxed italic">
                  Visual concept of append-only linked history. Real cryptographic verification will be bound to local storage.
                </p>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="sticky bottom-0 border-t border-border bg-sidebar/95 px-6 py-4 backdrop-blur-md">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="w-full text-xs"
              >
                Close Audit Record
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
