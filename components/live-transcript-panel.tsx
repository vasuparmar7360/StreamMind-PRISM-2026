"use client"

/**
 * LiveTranscriptPanel
 * ====================
 * Provides "Live Transcript Replay" mode on the Ask page.
 *
 * The user types (or pastes) an arbitrary question, then clicks Replay.
 * The text is split into small chunks (3–5 words each) and sent to the
 * backend one chunk at a time, at a configurable interval.
 *
 * Only the chunk currently being transmitted is sent — the full future text
 * is NOT sent in advance. When the last chunk is delivered, a final-input
 * event is sent and the backend generates the answer using any early evidence
 * that was already retrieved.
 *
 * EXPLICITLY LABELLED as simulated transcript input.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AskResponse, AskSource } from "@/lib/api"
import { Play, Square, Zap, Brain, CheckCircle2, AlertCircle, Loader2, Radio, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityEvent {
  ts: number
  kind: string
  detail: string
}

interface TimingInfo {
  first_chunk_to_retrieval: number | null
  first_chunk_to_final_input: number | null
  retrieval_duration: number | null
  answer_generation_duration: number | null
}

interface Subquestion {
  id: string
  text: string
  status: string
  sources: number
}

interface TranscriptResult {
  answer: any
  timing: TimingInfo
  activity: ActivityEvent[]
  early_retrieval_before_final: boolean
}

type ReplayState = "idle" | "replaying" | "waiting_answer" | "done" | "stopped" | "error"

// ─── Chunk splitter ───────────────────────────────────────────────────────────

function splitIntoChunks(text: string, wordsPerChunk = 4): string[] {
  const words = text.trim().split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }
  return chunks
}

// ─── Activity Panel ───────────────────────────────────────────────────────────

function ActivityPanel({ events, timing, earlyMetrics }: {
  events: ActivityEvent[]
  timing: TimingInfo | null
  earlyMetrics: { started_before_final: boolean; completed_before_final: boolean; evidence_reused: boolean } | null
}) {
  const [expanded, setExpanded] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events.length])

  const kindIcon: Record<string, React.ReactNode> = {
    input:           <span className="text-[10px] text-muted-foreground">→</span>,
    decision:        <Zap className="size-3 text-amber-400" />,
    decomposition_start: <Loader2 className="size-3 text-purple-400 animate-spin" />,
    decomposition_done:  <CheckCircle2 className="size-3 text-purple-400" />,
    decomposition_failed:<AlertCircle className="size-3 text-red-400" />,
    retrieval_start: <Loader2 className="size-3 text-brand-primary animate-spin" />,
    retrieval_done:  <CheckCircle2 className="size-3 text-success" />,
    final_input:     <Radio className="size-3 text-brand-primary" />,
    answer_start:    <Loader2 className="size-3 text-brand-primary animate-spin" />,
    answer_done:     <CheckCircle2 className="size-3 text-success" />,
    stopped:         <Square className="size-3 text-danger" />,
    invalidated:     <AlertCircle className="size-3 text-danger" />,
    keepalive:       null,
  }

  const kindColor: Record<string, string> = {
    decision:        "text-amber-300",
    decomposition_start: "text-purple-300",
    decomposition_done:  "text-purple-300",
    decomposition_failed: "text-red-300",
    retrieval_start: "text-blue-300",
    retrieval_done:  "text-green-300",
    final_input:     "text-purple-300",
    answer_start:    "text-blue-300",
    answer_done:     "text-green-300",
    stopped:         "text-red-300",
    invalidated:     "text-red-400",
  }

  const visibleEvents = events.filter(e => e.kind !== "keepalive")

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-text-primary transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <Zap className="size-3 text-amber-400" />
          Backend Activity
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{visibleEvents.length}</Badge>
        </span>
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <>
          <div className="max-h-48 overflow-y-auto px-3 pb-2 space-y-0.5 font-mono">
            {visibleEvents.length === 0 && (
              <p className="text-[10px] text-muted-foreground py-2 pl-1">Waiting for events…</p>
            )}
            {visibleEvents.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 shrink-0 pt-0.5">
                  +{ev.ts.toFixed(2)}s
                </span>
                <span className="shrink-0 pt-0.5">{kindIcon[ev.kind] ?? null}</span>
                <span className={cn("text-[10px] leading-tight", kindColor[ev.kind] ?? "text-text-secondary")}>
                  <span className="font-semibold">{ev.kind.replace(/_/g, " ")}</span>
                  {ev.detail && <span className="text-muted-foreground ml-1">— {ev.detail}</span>}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {timing && (
            <>
              <Separator className="mx-3" />
              <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                {timing.first_chunk_to_retrieval != null && (
                  <>
                    <span className="text-muted-foreground">First chunk → retrieval</span>
                    <span className={cn("font-semibold", earlyMetrics?.started_before_final ? "text-green-300" : "text-text-secondary")}>
                      {timing.first_chunk_to_retrieval.toFixed(3)}s
                    </span>
                  </>
                )}
                {timing.first_chunk_to_final_input != null && (
                  <>
                    <span className="text-muted-foreground">First chunk → final input</span>
                    <span className="text-text-secondary">{timing.first_chunk_to_final_input.toFixed(3)}s</span>
                  </>
                )}
                {timing.retrieval_duration != null && (
                  <>
                    <span className="text-muted-foreground">Retrieval duration</span>
                    <span className="text-text-secondary">{timing.retrieval_duration.toFixed(3)}s</span>
                  </>
                )}
                {timing.answer_generation_duration != null && (
                  <>
                    <span className="text-muted-foreground">Answer generation</span>
                    <span className="text-text-secondary">{timing.answer_generation_duration.toFixed(3)}s</span>
                  </>
                )}
                <span className="text-muted-foreground col-span-1">Early retrieval triggered?</span>
                <span className={cn("font-semibold col-span-1", earlyMetrics?.started_before_final ? "text-green-300" : "text-amber-300")}>
                  {earlyMetrics === null ? "—" : earlyMetrics.started_before_final ? "YES ✓" : "no"}
                </span>
                <span className="text-muted-foreground col-span-1">Early retrieval completed?</span>
                <span className={cn("font-semibold col-span-1", earlyMetrics?.completed_before_final ? "text-green-300" : "text-amber-300")}>
                  {earlyMetrics === null ? "—" : earlyMetrics.completed_before_final ? "YES ✓" : "no"}
                </span>
                <span className="text-muted-foreground col-span-1">Evidence reused?</span>
                <span className={cn("font-semibold col-span-1", earlyMetrics?.evidence_reused ? "text-green-300" : "text-amber-300")}>
                  {earlyMetrics === null ? "—" : earlyMetrics.evidence_reused ? "YES ✓" : "no"}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({ source, index, expanded, onToggle }: { source: AskSource; index: number; expanded: boolean; onToggle: () => void }) {
  return (
    <div id={`source-card-${source.label}`} className={cn("rounded-lg border bg-white/[0.03] overflow-hidden transition-colors", expanded ? "border-brand-primary/50" : "border-white/10")}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
      >
        <Badge variant="outline" className={cn("text-[10px] mt-0.5 shrink-0", expanded && "bg-brand-primary/10 text-brand-primary border-brand-primary/30")}>{source.label}</Badge>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary truncate">{source.document_name}</p>
          <p className="text-[10px] text-muted-foreground">
            Chunk {source.chunk_index} · score {source.similarity_score.toFixed(3)}
          </p>
        </div>
        {expanded ? <ChevronUp className="size-3 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronDown className="size-3 shrink-0 mt-0.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <p className="text-[11px] text-muted-foreground font-mono leading-relaxed bg-white/[0.03] rounded p-2 overflow-y-auto max-h-[300px]">
            {source.excerpt}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            chunk_id: {source.chunk_id}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LiveTranscriptPanel({
  sessionId,
  onAnswerReady,
}: {
  sessionId: string
  onAnswerReady?: (result: TranscriptResult) => void
}) {
  const [inputText, setInputText] = useState("")
  const [replayState, setReplayState] = useState<ReplayState>("idle")
  const [displayedTranscript, setDisplayedTranscript] = useState("")
  const [chunksTotal, setChunksTotal] = useState(0)
  const [chunksDone, setChunksDone] = useState(0)
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [timing, setTiming] = useState<TimingInfo | null>(null)
  const [earlyMetrics, setEarlyMetrics] = useState<{
    started_before_final: boolean;
    completed_before_final: boolean;
    evidence_reused: boolean;
  } | null>(null)
  const [result, setResult] = useState<TranscriptResult | null>(null)
  const [subquestions, setSubquestions] = useState<Subquestion[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // requestId is fresh per replay run
  const requestIdRef = useRef<string>("")
  const stoppedRef = useRef<boolean>(false)

  // SSE connection
  const esRef = useRef<EventSource | null>(null)

  const openSSE = useCallback((sid: string) => {
    esRef.current?.close()
    const url = api.transcriptStreamUrl(sid)
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        const kind: string = data.event ?? "unknown"
        if (kind === "keepalive") return
        if (kind === "subquestions") {
          setSubquestions(data.subquestions ?? [])
          return
        }
        setActivityEvents(prev => {
          const newEv = {
            ts: data.elapsed ?? 0,
            kind,
            detail: data.detail ?? "",
          }
          if (prev.some(e => e.ts === newEv.ts && e.kind === newEv.kind && e.detail === newEv.detail)) {
            return prev
          }
          return [...prev, newEv]
        })
      } catch {}
    }
    es.onerror = () => { /* SSE reconnects automatically */ }
  }, [])

  const stopSSE = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
  }, [])

  useEffect(() => () => stopSSE(), [stopSSE])

  const startReplay = useCallback(async () => {
    const text = inputText.trim()
    if (!text) return

    // Reset
    stoppedRef.current = false
    const rid = crypto.randomUUID()
    requestIdRef.current = rid
    setReplayState("replaying")
    setDisplayedTranscript("")
    setActivityEvents([])
    setTiming(null)
    setEarlyMetrics(null)
    setSubquestions([])
    setResult(null)
    setErrorMsg(null)

    // Open SSE channel
    openSSE(sessionId)

    const chunks = splitIntoChunks(text, 4)
    setChunksTotal(chunks.length)
    setChunksDone(0)

    // Send chunks with a delay between each
    for (let seq = 0; seq < chunks.length; seq++) {
      if (stoppedRef.current) return

      const chunk = chunks[seq]
      setDisplayedTranscript(prev => prev + (prev ? " " : "") + chunk)
      setChunksDone(seq + 1)

      try {
        await api.transcriptChunk({
          session_id: sessionId,
          request_id: rid,
          seq,
          text: chunk,
        })
      } catch {}

      if (seq < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 450))
      }
    }

    if (stoppedRef.current) return

    // Signal final input
    setReplayState("waiting_answer")
    try {
      const finalResult = await api.transcriptFinal({
        session_id: sessionId,
        request_id: rid,
      })

      if (stoppedRef.current) return

      setTiming(finalResult.timing ?? null)
      setEarlyMetrics(finalResult.early_retrieval_metrics ?? null)
      setResult(finalResult)
      setReplayState("done")
      onAnswerReady?.(finalResult)
    } catch (err: any) {
      if (!stoppedRef.current) {
        setErrorMsg(err.message ?? "Answer generation failed")
        setReplayState("error")
      }
    }
  }, [inputText, sessionId, openSSE, onAnswerReady])

  const stopReplay = useCallback(async () => {
    stoppedRef.current = true
    setReplayState("stopped")
    stopSSE()
    try {
      await api.transcriptStop({
        session_id: sessionId,
        request_id: requestIdRef.current,
      })
    } catch {}
    setActivityEvents(prev => [...prev, { ts: 0, kind: "stopped", detail: "stopped by user" }])
  }, [sessionId, stopSSE])

  const isActive = replayState === "replaying" || replayState === "waiting_answer"
  const progress = chunksTotal > 0 ? (chunksDone / chunksTotal) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-brand-primary" />
        <span className="text-sm font-semibold text-text-primary">Live Transcript Replay</span>
        <Badge variant="outline" className="text-[10px]">Simulated Input</Badge>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Sends text in chunks · early retrieval runs in the background
        </span>
      </div>

      {/* Input */}
      <Textarea
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder="Type a question or statement to replay as a live transcript…"
        className="min-h-[80px] resize-none text-sm font-mono bg-transparent border-white/10 focus:border-brand-primary/50 transition-colors"
        disabled={isActive}
        id="live-transcript-input"
      />

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!isActive ? (
          <Button
            id="transcript-replay-btn"
            size="sm"
            onClick={startReplay}
            disabled={!inputText.trim() || replayState === "waiting_answer"}
            className="gap-2"
          >
            <Play className="size-3" />
            Replay
          </Button>
        ) : (
          <Button
            id="transcript-stop-btn"
            size="sm"
            variant="destructive"
            onClick={stopReplay}
            className="gap-2"
          >
            <Square className="size-3" />
            Stop
          </Button>
        )}

        {/* State badge */}
        <div className="flex items-center gap-2">
          {replayState === "replaying" && (
            <Badge className="gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
              <span className="inline-block size-1.5 rounded-full bg-amber-400 animate-pulse" />
              Replaying {chunksDone}/{chunksTotal} chunks
            </Badge>
          )}
          {replayState === "waiting_answer" && (
            <Badge className="gap-1 bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
              <Loader2 className="size-2.5 animate-spin" />
              Generating answer…
            </Badge>
          )}
          {replayState === "done" && (
            <Badge className="gap-1 bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">
              <CheckCircle2 className="size-2.5" />
              Complete
            </Badge>
          )}
          {replayState === "stopped" && (
            <Badge className="gap-1 bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
              <Square className="size-2.5" />
              Stopped
            </Badge>
          )}
          {replayState === "error" && (
            <Badge className="gap-1 bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
              <AlertCircle className="size-2.5" />
              Error
            </Badge>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(replayState === "replaying") && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Live transcript display */}
      {displayedTranscript && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
            Transcript received so far
          </p>
          <p className="text-sm text-text-primary leading-relaxed">
            {displayedTranscript}
            {isActive && (
              <span className="inline-block ml-0.5 w-0.5 h-3.5 bg-brand-primary animate-pulse rounded-sm align-middle" />
            )}
          </p>
        </div>
      )}

      {/* Subquestions Panel */}
      {subquestions.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between border-b border-white/5">
            <span className="flex items-center gap-2 font-medium">
              <Brain className="size-3 text-purple-400" />
              Questions identified
            </span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{subquestions.length}</Badge>
          </div>
          <div className="p-3 space-y-2">
            {subquestions.map((sq, i) => (
              <div key={sq.id} className="flex flex-col gap-1 rounded bg-white/[0.02] p-2 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-text-primary">Q{i + 1}: {sq.text}</span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] h-auto py-0.5",
                    sq.status === "searching" ? "border-blue-500/30 text-blue-300" :
                    sq.status === "evidence_found" ? "border-green-500/30 text-green-300" :
                    "border-amber-500/30 text-amber-300"
                  )}>
                    {sq.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Sources: {sq.sources}</span>
                  {sq.status === "evidence_found" && (
                    <span className="text-green-300/80">(Evidence ready)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity panel */}
      {activityEvents.length > 0 && (
        <ActivityPanel
          events={activityEvents}
          timing={timing}
          earlyMetrics={earlyMetrics}
        />
      )}

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Answer */}
      {result?.answer && (
        <div className="space-y-3">
          <Separator />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-xs font-semibold text-text-primary">Answer</span>
                {earlyMetrics?.evidence_reused ? (
                  <Badge className="text-[10px] bg-green-500/20 text-green-300 border-green-500/30">
                    Early evidence used ✓
                  </Badge>
                ) : earlyMetrics?.started_before_final ? (
                  <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">
                    Early retrieval started
                  </Badge>
                ) : null}
              </div>
              {result.answer.answer_version && result.answer.answer_version > 1 && (
                <Badge variant="outline" className="border-brand-primary/30 text-brand-primary-hover text-[10px]">
                  v{result.answer.answer_version}
                </Badge>
              )}
            </div>
            
            {result.answer.what_changed && (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary mr-2">Update:</span>
                {result.answer.what_changed}
              </div>
            )}
            
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {result.answer.answer.split(/(\[S\d+\])/g).map((part: string, i: number) => {
                if (part.match(/^\[S\d+\]$/)) {
                  const label = part.replace('[', '').replace(']', '')
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setExpandedSource(label)
                        document.getElementById(`source-card-${label}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                      }}
                      className="mx-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 cursor-pointer"
                    >
                      {label}
                    </button>
                  )
                }
                return <span key={i}>{part}</span>
              })}
            </p>
          </div>

          {result.answer.sources?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Sources — click to verify excerpt
              </p>
              {result.answer.sources.map((src: AskSource, i: number) => (
                <SourceCard
                  key={src.chunk_id}
                  source={src}
                  index={i}
                  expanded={expandedSource === src.label}
                  onToggle={() => setExpandedSource(prev => prev === src.label ? null : src.label)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
