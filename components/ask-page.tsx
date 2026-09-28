"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Sparkles,
  Brain,
  FileText,
  ShieldCheck,
  ArrowRight,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { sampleSuggestions } from "@/lib/ask-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, AskResponse } from "@/lib/api"

export function AskPage() {
  const evidenceNodes = useRef<Map<string, HTMLDivElement>>(new Map())
  const [inputValue, setInputValue] = useState<string>("")
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [response, setResponse] = useState<AskResponse | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedSourceId) return
    const evidence = evidenceNodes.current.get(selectedSourceId)
    evidence?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
    evidence?.focus({ preventScroll: true })
  }, [selectedSourceId])

  const handleSelectSuggestion = (query: string) => {
    setInputValue(query)
    // We could auto-submit here, but preserving manual submit allows user to edit
  }

  const handleCustomSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    setIsLoading(true)
    setBackendError(null)
    setResponse(null)
    setSelectedSourceId(null)

    try {
      const res = await api.askOwnMind(inputValue.trim())
      setResponse(res)
    } catch (err: any) {
      setBackendError(err.message || "OwnMind backend is unavailable.")
    } finally {
      setIsLoading(false)
      setInputValue("")
    }
  }

  const isConflict = response?.status === "conflicting_evidence"
  const isInsufficient = response?.status === "insufficient_evidence"
  const isModelUnavailable = response?.status === "model_unavailable"

  return (
    <div className="page-container animate-page-enter">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-medium text-text-muted">
            <span className="size-1.5 rounded-full bg-brand-primary" />
            Project Intelligence
          </div>
          <Badge
            variant="outline"
            className="border-brand-primary/30 bg-brand-primary/[0.08] text-brand-primary-hover font-medium text-[11px] gap-1.5 py-1 px-3"
          >
            <ShieldCheck className="size-3.5" />
            Evidence-Backed Reasoning
          </Badge>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Ask{" "}
          <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
            OwnMind
          </span>
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-text-muted">
          Ask across your project knowledge, decisions and memory — with traceable evidence.
        </p>

        {/* ─── COGNITIVE PIPELINE INDICATOR ───────────────────────────────────── */}
        <div className="signal-flow mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/80 p-2.5 text-[11px] text-text-muted">
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <span className="flex size-4 items-center justify-center rounded-full bg-brand-primary/20 text-[10px] font-bold text-brand-primary-hover">
              1
            </span>
            <span>Question</span>
          </div>
          <ArrowRight className="size-3 text-text-muted/40" />
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <span className="flex size-4 items-center justify-center rounded-full bg-brand-primary/20 text-[10px] font-bold text-brand-primary-hover">
              2
            </span>
            <span>Retrieve Evidence</span>
          </div>
          <ArrowRight className="size-3 text-text-muted/40" />
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <span className="flex size-4 items-center justify-center rounded-full bg-brand-secondary/20 text-[10px] font-bold text-brand-secondary">
              3
            </span>
            <span>Compare Decisions</span>
          </div>
          <ArrowRight className="size-3 text-text-muted/40" />
          <div className="flex items-center gap-1.5 font-medium text-text-primary">
            <span className="flex size-4 items-center justify-center rounded-full bg-success/20 text-[10px] font-bold text-success">
              4
            </span>
            <span>Answer with Sources</span>
          </div>
        </div>
      </div>

      {/* ─── TWO COLUMN MAIN LAYOUT ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ─── LEFT COLUMN (approx 65%) ────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-8">
          
          {/* User Question Input Box */}
          <div className="space-y-3">
            <form
              onSubmit={handleCustomSubmit}
              className="relative flex items-center rounded-2xl border border-border bg-card/70 px-4 py-2 shadow-sm transition-all focus-within:border-accent-cyan/50 focus-within:ring-1 focus-within:ring-brand-primary/30"
            >
              <Sparkles className="size-4 shrink-0 text-brand-primary-hover mr-3" />
              <input
                type="text"
                aria-label="Ask about your project knowledge"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder='Ask about your project knowledge... (e.g. "What changed in the architecture this week?")'
                className="w-full bg-transparent text-sm text-foreground placeholder:text-text-muted outline-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !inputValue.trim()}
                className="ml-2 gap-1.5 bg-brand-primary hover:bg-brand-primary/90 text-primary-foreground font-semibold text-xs rounded-xl"
              >
                {isLoading ? "Thinking..." : "Send"}
                {isLoading ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              </Button>
            </form>

            {/* Quick Suggestions Chips */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 px-1">
                Suggested Questions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sampleSuggestions.map((item) => (
                  <button
                    key={item.queryKey}
                    type="button"
                    onClick={() => handleSelectSuggestion(item.label)}
                    disabled={isLoading}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs transition-all cursor-pointer bg-surface/70 text-text-muted hover:border-brand-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="surface-card flex items-center justify-center gap-3 rounded-3xl border border-border bg-surface/70 p-12 ring-1 ring-border/50 text-text-muted">
              <Loader2 className="size-5 animate-spin text-brand-primary" />
              <span className="text-sm font-medium">Searching project memory and generating grounded answer...</span>
            </div>
          )}

          {/* Backend Error */}
          {backendError && !isLoading && (
            <div className="surface-card flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="size-5" />
              <p className="text-sm font-medium">{backendError}</p>
            </div>
          )}

          {/* OwnMind Response Section */}
          {response && !isLoading && (
            <div className="space-y-6">
              {/* User Question */}
              <div className="surface-card flex items-start gap-3 rounded-2xl border border-border bg-surface/90 p-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary/30 to-accent-purple/30 text-xs font-semibold text-foreground ring-1 ring-inset ring-white/10">
                  PT
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-text-muted">Project Team Query</p>
                    <span className="text-[10px] text-text-muted">Live Memory Session</span>
                  </div>
                  <p className="mt-1 text-base font-medium text-text-primary">
                    “{response.question}”
                  </p>
                </div>
              </div>

              <div className="answer-sequence surface-card relative overflow-hidden rounded-3xl border border-border bg-surface/70 p-6 ring-1 ring-border/50">
                {/* Ambient subtle glow */}
                <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gradient-to-br from-brand-primary/10 to-accent-purple/10 blur-3xl" />

                {/* Answer Header */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex size-8 items-center justify-center rounded-xl bg-brand-primary/15 ring-1 ring-inset ring-brand-primary/30">
                      <Brain className="size-4 text-brand-primary-hover" />
                      <span className="absolute inset-0 rounded-xl shadow-none opacity-70" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-text-primary">OwnMind</p>
                        {response.model && (
                          <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-primary-hover">
                            Local {response.model}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted">Sovereign Memory & Lineage Engine</p>
                    </div>
                  </div>

                  {isConflict && (
                    <Badge variant="conflict">
                      <span className="size-1 rounded-full bg-destructive" />
                      CONFLICT DETECTED
                    </Badge>
                  )}
                </div>

                {/* Answer text paragraphs */}
                {isModelUnavailable ? (
                   <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium">
                     <AlertTriangle className="size-5" />
                     {response.answer || "Local AI model is currently unavailable."}
                   </div>
                ) : isInsufficient ? (
                  <div className="space-y-2 text-sm leading-relaxed text-text-primary/95">
                    <p>{response.answer}</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm leading-relaxed text-text-primary/95 whitespace-pre-wrap">
                    {response.answer}
                  </div>
                )}

                {/* ─── SOURCE CITATIONS (CLICKABLE CHIPS) ───────────────────────── */}
                {!isInsufficient && !isModelUnavailable && response.sources && response.sources.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Authoritative Citations &nbsp;
                      <span className="text-[10px] font-normal text-text-muted">
                        (Click to inspect in Evidence panel)
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {response.sources.map((src) => {
                        const isSelected = selectedSourceId === src.chunk_id
                        return (
                          <button
                            key={src.chunk_id}
                            type="button"
                            onClick={() => setSelectedSourceId(isSelected ? null : src.chunk_id)}
                            aria-pressed={isSelected}
                            aria-controls={`evidence-${src.chunk_id}`}
                            className={cn(
                              "group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all duration-200 cursor-pointer",
                              isSelected
                                ? "border-accent-cyan bg-brand-primary/15 text-brand-primary-hover shadow-none ring-1 ring-brand-primary"
                                : "border-border bg-surface/90 text-text-muted hover:border-brand-primary/40 hover:text-foreground",
                            )}
                          >
                            <span className="font-mono text-[10px] font-bold text-brand-primary-hover">
                              [{src.label}]
                            </span>
                            <FileText className="size-3 text-text-muted group-hover:text-brand-primary-hover transition-colors" />
                            <span className="font-medium text-text-primary">{src.document_name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN — EVIDENCE PANEL (approx 35%) ─────────────────── */}
        <div className="lg:col-span-4">
          {response && !isInsufficient && !isModelUnavailable && response.sources && response.sources.length > 0 && (
            <div className="sticky top-6 space-y-5">
              <div className="surface-card rounded-3xl border border-border bg-surface/80 p-5 ring-1 ring-border/50">
                {/* Evidence Panel Header */}
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3.5">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-brand-primary-hover" />
                    <h3 className="text-sm font-semibold text-text-primary">Evidence Used</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-border text-text-muted">
                    {response.sources.length} Documents
                  </Badge>
                </div>

                {/* Evidence Sources List */}
                <div className="space-y-4">
                  {response.sources.map((src, index) => {
                    const isHighlighted = selectedSourceId === src.chunk_id

                    return (
                      <div
                        key={src.chunk_id}
                        id={`evidence-${src.chunk_id}`}
                        tabIndex={-1}
                        ref={(node) => { if (node) evidenceNodes.current.set(src.chunk_id, node); else evidenceNodes.current.delete(src.chunk_id) }}
                        className={cn(
                          isHighlighted && "evidence-focused",
                          "rounded-2xl border p-4 transition-all duration-300",
                          isHighlighted
                            ? "border-accent-cyan bg-brand-primary/[0.08] shadow-none ring-1 ring-brand-primary"
                            : "border-border bg-background/50 hover:border-border",
                        )}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold text-brand-primary-hover">
                                SOURCE {index + 1}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                · [{src.label}]
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {src.document_name}
                            </p>
                          </div>
                        </div>

                        {/* Passage Box */}
                        <div className="mt-3 rounded-xl border border-border bg-surface/90 p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">
                            Relevant passage:
                          </p>
                          <p className="text-xs leading-relaxed text-text-primary/90 italic">
                            “{src.excerpt}”
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
