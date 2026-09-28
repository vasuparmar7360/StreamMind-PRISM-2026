"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import {
  Cpu,
  Brain,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Layers,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Trash2,
  Download,
  Edit3,
  FileText,
  FileCode,
  HardDrive,
  Database,
  ExternalLink,
  ChevronRight,
  Info,
  Sliders,
  Sparkles,
  RefreshCw,
  Power,
  UserCheck,
  Save,
  Clock,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  initialModels,
  initialMemorySummary,
  initialMemories,
  initialTools,
  initialExecutionPolicies,
  initialPrivacyCards,
  type MemoryItem,
  type ToolPermission,
  type ModelOption,
} from "@/lib/settings-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function SettingsPage() {
  // State for Models
  const [models, setModels] = useState<ModelOption[]>(initialModels)
  const [showModelModal, setShowModelModal] = useState(false)
  const [activeModel, setActiveModel] = useState<ModelOption>(
    initialModels.find((m) => m.active) || initialModels[0],
  )
  const [isOnline, setIsOnline] = useState(true)

  // State for Memories
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [memorySummary, setMemorySummary] = useState({
    total: 0,
    activeDecisions: 0,
    historicalDecisions: 0,
    conflicts: 0
  })
  const [activeMemoryTab, setActiveMemoryTab] = useState<
    "Facts" | "Decisions" | "People" | "Projects" | "Preferences"
  >("Decisions")
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null)

  // Delete Modals
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryItem | null>(null)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Tools & Execution Policy
  const [tools, setTools] = useState<ToolPermission[]>(initialTools)
  const [policies, setPolicies] = useState(initialExecutionPolicies)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3200)
  }

  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const [sysRes, memRes] = await Promise.all([
          api.getSystemStatus(),
          api.getMemorySummary()
        ])
        
        setMemorySummary({
          total: memRes.documents_indexed, 
          activeDecisions: memRes.active_decisions,
          historicalDecisions: memRes.replaced_decisions,
          conflicts: memRes.open_conflicts,
        })
        
        if (sysRes.chat_model && sysRes.chat_model.name) {
          setActiveModel(prev => ({
            ...prev,
            name: sysRes.chat_model.name || "Unknown",
            runtime: "Local Engine",
            description: "Connected to backend model"
          }))
        }
        
        setIsOnline(sysRes.ollama?.status === "online")
      } catch (e) {
        console.error(e)
      }
    }
    loadSettingsData()
  }, [])

  const handleExport = async () => {
    try {
      showToast("Preparing memory export...")
      const data = await api.exportMemory()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      a.download = `ownmind-memory-export-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast("Project memory exported successfully.")
    } catch (e) {
      showToast("Failed to export memory.")
    }
  }

  // Model switch
  const handleSelectModel = (model: ModelOption) => {
    showToast("Model switching not configurable in this prototype")
  }

  // Delete single memory
  const handleConfirmDeleteMemory = () => {
    showToast("Memory deletion not supported in this prototype")
    setMemoryToDelete(null)
  }

  // Clear all memory
  const handleConfirmClearAll = () => {
    setMemories([])
    setMemorySummary({
      total: 0,
      activeDecisions: 0,
      historicalDecisions: 0,
      conflicts: 0,
    })
    setSelectedMemory(null)
    setShowClearAllModal(false)
    showToast("All active memories cleared. Source files preserved.")
  }

  // Toggle tool
  const handleToggleTool = (toolId: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)),
    )
    const target = tools.find((t) => t.id === toolId)
    showToast(`Tool ${target?.name} is now ${!target?.enabled ? "Enabled" : "Disabled"}`)
  }

  // Toggle policy
  const handleTogglePolicy = (key: keyof typeof policies) => {
    setPolicies((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      return next
    })
  }

  const filteredMemories = memories.filter((m) => m.tab === activeMemoryTab)

  return (
    <div className="page-container animate-page-enter">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-brand-primary/40 bg-sidebar/95 px-4 py-3 text-xs text-foreground shadow-2xl backdrop-blur-md ring-1 ring-brand-primary/20 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Sparkles className="size-4 text-brand-primary-hover shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-medium text-text-muted">
            <span className="size-1.5 rounded-full bg-brand-primary" />
            Sovereign Control
          </div>
          <Badge
            variant="outline"
            className="border-brand-primary/30 bg-brand-primary/[0.08] text-brand-primary-hover font-medium text-[11px] gap-1.5 py-1 px-3"
          >
            <ShieldCheck className="size-3.5" />
            User-Owned AI
          </Badge>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Sovereign{" "}
          <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-secondary bg-clip-text text-transparent">
            Control Center
          </span>
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-text-muted">
          Control your model, memory, tools and privacy from one place.
        </p>

        {/* ─── SOVEREIGN PHILOSOPHY BANNER ───────────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-accent-cyan/25 bg-gradient-to-r from-brand-primary/[0.07] via-background to-accent-purple/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-primary/15 text-brand-primary-hover ring-1 ring-inset ring-brand-primary/30">
              <Lock className="size-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary-hover">
                Fundamental Invariant
              </p>
              <p className="text-xs font-semibold text-text-primary">
                THE AI IS NOT THE OWNER OF THE MEMORY. THE USER IS.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-text-muted">
            Inspect · Edit · Delete · Restrict Tools · Regulate Privacy
          </span>
        </div>
      </div>

      <div className="space-y-12">
        {/* ─── SECTION 1: LOCAL AI ENGINE ────────────────────────────────────── */}
        <section aria-labelledby="local-ai-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="local-ai-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            >
              Local AI Engine
            </h2>
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
                <span className="size-2 rounded-full bg-success animate-pulse shadow-none" />
                LOCAL MODEL ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-danger font-medium">
                <span className="size-2 rounded-full bg-danger shadow-none" />
                LOCAL MODEL UNAVAILABLE
              </span>
            )}
          </div>

          <div className="surface-card relative overflow-hidden rounded-3xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-brand-primary/10 blur-3xl" />

            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-primary/15 text-brand-primary-hover ring-1 ring-inset ring-brand-primary/30">
                  <Cpu className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className={cn("text-lg font-semibold", isOnline ? "text-text-primary" : "text-danger")}>
                      {isOnline ? activeModel.name : "Offline"}
                    </h3>
                    <Badge variant="current" className="text-[10px]">
                      {activeModel.runtime}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted max-w-xl">
                    {isOnline ? activeModel.description : "Ollama engine is unreachable."}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => showToast("Model switching not configurable in this prototype")}
                className="gap-1.5 border-brand-primary/30 text-brand-primary-hover hover:bg-brand-primary/10 text-xs shrink-0"
              >
                <RefreshCw className="size-3.5" />
                Change Model
              </Button>
            </div>

            {/* Hardware & Runtime Matrix */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5 border-t border-border pt-5 text-xs">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="text-[10px] text-text-muted block uppercase font-medium">
                  Model
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">{activeModel.name}</span>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="text-[10px] text-text-muted block uppercase font-medium">
                  Runtime
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">{activeModel.runtime}</span>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="text-[10px] text-text-muted block uppercase font-medium">
                  Inference
                </span>
                <span className="font-semibold text-success mt-0.5 block">Local GPU/CPU</span>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="text-[10px] text-text-muted block uppercase font-medium">
                  Privacy Status
                </span>
                <span className="font-semibold text-success mt-0.5 block">No cloud inference</span>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <span className="text-[10px] text-text-muted block uppercase font-medium">
                  Device
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">Local Machine</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: MEMORY CONTROL CENTER (VISUALLY STRONGER) ─────────── */}
        <section data-authority="memory" aria-labelledby="memory-control-heading">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="memory-control-heading"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary-hover"
              >
                Memory Control Center
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                See exactly what OwnMind remembers, inspect provenance, and manage it.
              </p>
            </div>

            {/* Global Memory Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-1.5 text-xs"
              >
                <Download className="size-3.5" />
                Export Memory
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowClearAllModal(true)}
                className="gap-1.5 border-danger/30 text-danger hover:bg-danger/10 text-xs"
              >
                <Trash2 className="size-3.5" />
                Clear All Memory
              </Button>
            </div>
          </div>

          {/* Memory Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="surface-card rounded-2xl border border-brand-primary/20 bg-surface/90 p-4">
              <span className="text-2xl font-bold tracking-tight text-text-primary">
                {memorySummary.total}
              </span>
              <p className="text-xs text-text-muted mt-0.5">Memories Stored</p>
            </div>
            <div className="surface-card rounded-2xl border border-success/20 bg-surface/90 p-4">
              <span className="text-2xl font-bold tracking-tight text-success">
                {memorySummary.activeDecisions}
              </span>
              <p className="text-xs text-text-muted mt-0.5">Active Decisions</p>
            </div>
            <div className="surface-card rounded-2xl border border-border bg-surface/90 p-4">
              <span className="text-2xl font-bold tracking-tight text-text-muted">
                {memorySummary.historicalDecisions}
              </span>
              <p className="text-xs text-text-muted mt-0.5">Historical Decisions</p>
            </div>
            <div className="surface-card rounded-2xl border border-warning/20 bg-surface/90 p-4">
              <span className="text-2xl font-bold tracking-tight text-warning">
                {memorySummary.conflicts}
              </span>
              <p className="text-xs text-text-muted mt-0.5">Conflicts</p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
            {(["Facts", "Decisions", "People", "Projects", "Preferences"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveMemoryTab(tab)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  activeMemoryTab === tab
                    ? "bg-brand-primary/15 text-brand-primary-hover ring-1 ring-brand-primary/30"
                    : "text-text-muted hover:bg-card/80 hover:text-foreground",
                )}
              >
                {tab}
                <span className="ml-1.5 font-mono text-[10px] opacity-60">
                  ({memories.filter((m) => m.tab === tab).length})
                </span>
              </button>
            ))}
          </div>

          {/* Memory Cards Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {filteredMemories.length > 0 ? (
              filteredMemories.map((item) => (
                <div
                  key={item.id}
                  className="surface-card group relative flex flex-col justify-between rounded-2xl border border-border bg-surface/70 p-5 transition-all hover:border-brand-primary/40 hover:bg-card/70"
                >
                  <div>
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-semibold text-brand-primary-hover">
                        {item.type}
                      </span>
                      <Badge variant="current" className="text-[9px]">
                        {item.status}
                      </Badge>
                    </div>

                    <p
                      onClick={() => setSelectedMemory(item)}
                      className="cursor-pointer text-sm font-semibold text-foreground leading-snug hover:text-brand-primary-hover transition-colors"
                    >
                      {item.memory}
                    </p>

                    {item.replaces && (
                      <div className="mt-2 text-xs text-text-muted">
                        <span className="text-[10px] uppercase font-semibold text-text-muted block">
                          Replaces:
                        </span>
                        <span className="line-through decoration-muted-foreground/40">
                          {item.replaces}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted">
                      <FileText className="size-3 text-brand-primary-hover shrink-0" />
                      <span className="truncate">{item.source}</span>
                      <span>· {item.created}</span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedMemory(item)}
                      className="text-[11px] text-brand-primary-hover hover:text-brand-primary-hover"
                    >
                      View Provenance
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => showToast(`Edit memory for ${item.id}`)}
                        title="Edit Memory"
                      >
                        <Edit3 className="size-3 text-text-muted hover:text-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setMemoryToDelete(item)}
                        title="Delete Memory"
                      >
                        <Trash2 className="size-3 text-danger hover:text-danger" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-border bg-card/20 py-10 text-center text-xs text-text-muted">
                No memories found in {activeMemoryTab} tab.
              </div>
            )}
          </div>
        </section>

        {/* ─── SECTION 3: TOOL PERMISSIONS (VISUALLY STRONGER) ───────────────── */}
        <section aria-labelledby="tool-permissions-heading">
          <div className="mb-4">
            <h2
              id="tool-permissions-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-secondary"
            >
              Tool Permissions
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Configure allowed tools and execution boundaries. Default requires user approval before every action.
            </p>
          </div>

          <div className="mb-4 rounded-xl border border-brand-secondary/30 bg-brand-secondary/[0.05] p-3.5 text-xs text-brand-secondary">
            <div className="flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Workspace Boundary Invariant: </strong>
                OwnMind cannot execute tools outside the approved workspace directory. Direct execution without approval is blocked.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className={cn(
                  "rounded-2xl border p-5 transition-all",
                  tool.enabled
                    ? "border-border bg-surface/80"
                    : "border-border bg-muted/10 opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Terminal className="size-4 text-brand-secondary" />
                      <h3 className="font-mono text-sm font-semibold text-text-primary">
                        {tool.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{tool.description}</p>
                  </div>

                  {/* Tool Enable/Disable Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleTool(tool.id)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      tool.enabled ? "bg-brand-secondary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        tool.enabled ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-[11px]">
                  <div>
                    <span className="text-text-muted block">Scope:</span>
                    <span className="font-medium text-text-primary">{tool.scope}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Requires Approval:</span>
                    <span className="font-semibold text-success">
                      {tool.requiresApproval ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Auto Execution:</span>
                    <span className="font-semibold text-text-muted">
                      {tool.allowAutomaticExecution ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── SECTION 4: ACTION EXECUTION POLICY ─────────────────────────────── */}
        <section aria-labelledby="action-policy-heading">
          <div className="mb-4">
            <h2
              id="action-policy-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            >
              Execution Policy
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Define the verification criteria before any AI action enters review.
            </p>
          </div>

          <div className="surface-card rounded-3xl border border-border bg-surface/70 p-6 space-y-4">
            {/* Policy Toggles */}
            <div className="divide-y divide-border/60">
              {[
                {
                  key: "requireApproval" as const,
                  title: "Require approval before execution",
                  desc: "Guarantees no AI action can execute without human sign-off.",
                },
                {
                  key: "blockDuplicates" as const,
                  title: "Block duplicate actions",
                  desc: "Prevents duplicate task creation if an identical pending action exists.",
                },
                {
                  key: "rejectWithoutEvidence" as const,
                  title: "Reject actions without evidence",
                  desc: "Halts tool generation if no dated source document references the change.",
                },
                {
                  key: "highRiskManualConfirmation" as const,
                  title: "High-risk actions require manual confirmation",
                  desc: "Disables one-click approvals for schema migrations or destructive calls.",
                },
                {
                  key: "allowBackgroundAutomatic" as const,
                  title: "Allow background automatic actions",
                  desc: "Keep DISABLED to ensure total air-gapped sovereign control.",
                },
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePolicy(key)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      policies[key] ? "bg-brand-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        policies[key] ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Stepper Flow */}
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                Mandatory Verification Pipeline
              </p>
              <div className="signal-flow flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background-secondary/60 p-2.5 text-[11px] text-text-muted">
                <span className="font-semibold text-text-primary">AI Proposal</span>
                <ArrowRight className="size-3 text-text-muted/40" />
                <span className="font-semibold text-brand-secondary">Policy Gate</span>
                <ArrowRight className="size-3 text-text-muted/40" />
                <span className="font-semibold text-success">User Approval</span>
                <ArrowRight className="size-3 text-text-muted/40" />
                <span className="font-semibold text-brand-primary-hover">Tool Execution</span>
                <ArrowRight className="size-3 text-text-muted/40" />
                <span className="font-semibold text-text-primary">Audit Record</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 5: PRIVACY & DATA SOVEREIGNTY ─────────────────────────── */}
        <section aria-labelledby="privacy-heading">
          <div className="mb-4">
            <h2
              id="privacy-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            >
              Privacy & Data Sovereignty
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Real-time audit of local telemetry, network boundaries, and storage isolation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {initialPrivacyCards.map((card, i) => (
              <div key={i} className="surface-card rounded-2xl border border-border bg-surface/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {card.label}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success" />
                  <span className="text-sm font-bold text-text-primary">{card.status}</span>
                </div>
                <p className="mt-2 text-[10px] text-text-muted leading-relaxed">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-success/25 bg-success/[0.04] p-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-success">
              <ShieldCheck className="size-4" />
              <span>YOUR PROJECT DATA STAYS UNDER YOUR CONTROL</span>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6: DATA MANAGEMENT ────────────────────────────────────── */}
        <section aria-labelledby="data-management-heading" className="border-t border-border pt-8">
          <div className="mb-4">
            <h2
              id="data-management-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            >
              Data Management & Backup
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Export portable snapshots or manage local workspace retention.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => showToast("Knowledge Base exported as JSON")}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Export Knowledge Base
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => showToast("Audit Log exported as CSV")}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Export Audit Log
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => showToast("Decision Lineage tree exported")}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Export Decision History
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => showToast("Backup archive created in local /backups folder")}
              className="gap-1.5 text-xs"
            >
              <HardDrive className="size-3.5" />
              Backup Local Workspace
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteWorkspaceModal(true)}
              className="gap-1.5 text-xs ml-auto"
            >
              <Trash2 className="size-3.5" />
              Delete Workspace Data
            </Button>
          </div>
        </section>
      </div>

      {/* ─── MODAL: CHANGE MODEL ────────────────────────────────────────────── */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setShowModelModal(false)}
            aria-hidden="true"
          />
          <div className="modal-panel relative z-50 w-full max-w-lg rounded-3xl border border-border bg-sidebar p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Select Local Model</h3>
                <p className="text-xs text-text-muted">
                  Choose a model running on your local inference server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModelModal(false)}
                className="text-text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelectModel(model)}
                  className={cn(
                    "flex w-full items-start justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer",
                    model.id === activeModel.id
                      ? "border-accent-cyan bg-brand-primary/10 ring-1 ring-brand-primary"
                      : "border-border bg-surface/90 hover:bg-card/90",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{model.name}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                        {model.parameterSize}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted leading-relaxed">
                      {model.description}
                    </p>
                    <span className="mt-2 block font-mono text-[10px] text-brand-primary-hover">
                      Runtime: {model.runtime}
                    </span>
                  </div>

                  {model.id === activeModel.id && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-primary text-primary-foreground">
                      <Check className="size-3 font-bold" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowModelModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DRAWER: MEMORY PROVENANCE (RIGHT-SIDE PANEL) ───────────────────── */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setSelectedMemory(null)}
            aria-hidden="true"
          />
          <aside
            className="detail-drawer relative z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-sidebar shadow-2xl overflow-y-auto"
            aria-label="Memory Provenance Detail"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-sidebar/95 px-6 py-5 backdrop-blur-md">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary-hover">
                  Memory Provenance
                </p>
                <h3 className="text-base font-semibold text-foreground mt-0.5">
                  {selectedMemory.type}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemory(null)}
                className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 space-y-6">
              {/* Memory Details Overview */}
              <div className="surface-card rounded-2xl border border-border bg-surface/90 p-4 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-muted block">
                    Stored Memory Value:
                  </span>
                  <span className="text-sm font-semibold text-foreground mt-0.5 block">
                    {selectedMemory.memory}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2">
                  <span className="text-text-muted">Type:</span>
                  <span className="font-medium text-text-primary">{selectedMemory.type}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2">
                  <span className="text-text-muted">Source:</span>
                  <span className="font-mono text-brand-primary-hover">{selectedMemory.source}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2">
                  <span className="text-text-muted">Date Ingested:</span>
                  <span className="font-medium text-text-primary">{selectedMemory.created}</span>
                </div>
                {selectedMemory.previousMemory && (
                  <div className="border-t border-border/50 pt-2">
                    <span className="text-text-muted block">Previous Memory:</span>
                    <span className="text-text-muted line-through block mt-0.5">
                      {selectedMemory.previousMemory}
                    </span>
                    {selectedMemory.previousSource && (
                      <span className="text-[10px] text-text-muted block mt-0.5">
                        Previous Source: {selectedMemory.previousSource}
                      </span>
                    )}
                  </div>
                )}
                {selectedMemory.reasonForChange && (
                  <div className="border-t border-border/50 pt-2">
                    <span className="text-text-muted block">Reason for Change:</span>
                    <span className="font-medium text-text-primary/90 block mt-0.5">
                      {selectedMemory.reasonForChange}
                    </span>
                  </div>
                )}
                {selectedMemory.linkedDecision && (
                  <div className="flex justify-between border-t border-border/50 pt-2">
                    <span className="text-text-muted">Linked Decision:</span>
                    <span className="font-semibold text-brand-primary-hover">
                      {selectedMemory.linkedDecision}
                    </span>
                  </div>
                )}
              </div>

              {/* Memory History Vertical Flow */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
                  Memory History
                </p>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {selectedMemory.historySteps.map((step, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-1.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-primary/20 text-brand-primary-hover">
                        <span className="size-1.5 rounded-full bg-brand-primary" />
                      </div>
                      <div className="rounded-xl border border-border bg-background/50 p-3 text-xs flex-1">
                        <span className="font-mono text-[10px] text-brand-primary-hover block font-semibold">
                          {step.date}
                        </span>
                        <span className="text-text-primary/90 mt-0.5 block">{step.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Actions if any */}
              {selectedMemory.linkedActions && selectedMemory.linkedActions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                    Linked Actions Triggered
                  </p>
                  <div className="space-y-1.5">
                    {selectedMemory.linkedActions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl border border-brand-secondary/20 bg-brand-secondary/[0.05] p-2.5 text-xs text-text-primary"
                      >
                        <UserCheck className="size-3.5 text-brand-secondary shrink-0" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="sticky bottom-0 border-t border-border bg-sidebar/95 px-6 py-4 backdrop-blur-md flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setMemoryToDelete(selectedMemory)
                  setSelectedMemory(null)
                }}
                className="text-xs gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete Memory
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedMemory(null)}
                className="text-xs"
              >
                Close Provenance
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── MODAL: DELETE MEMORY CONFIRMATION ──────────────────────────────── */}
      {memoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMemoryToDelete(null)}
            aria-hidden="true"
          />
          <div className="modal-panel relative z-50 w-full max-w-md rounded-3xl border border-danger/30 bg-sidebar p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-danger/15 text-danger">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Delete Memory?</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  This removes the selected memory from OwnMind’s active memory store.
                  <br />
                  <strong className="text-foreground">Source files will not be deleted.</strong>
                </p>
                <div className="mt-3 rounded-xl border border-border bg-background/60 p-2.5 text-xs text-foreground font-medium">
                  “{memoryToDelete.memory}”
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemoryToDelete(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDeleteMemory}
                className="text-xs gap-1"
              >
                Delete Memory
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CLEAR ALL MEMORY ────────────────────────────────────────── */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setShowClearAllModal(false)}
            aria-hidden="true"
          />
          <div className="modal-panel relative z-50 w-full max-w-md rounded-3xl border border-danger/40 bg-sidebar p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-danger/20 text-danger">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Clear Entire Memory Vault?</h3>
                <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                  This action permanently purges all 41 stored memories, entity links, and decision lineage caches from the local engine.
                </p>
                <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-[11px] text-danger">
                  Source documents will remain intact on your local disk.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowClearAllModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmClearAll}
                className="text-xs"
              >
                Clear All Memory
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE WORKSPACE DATA ───────────────────────────────────── */}
      {showDeleteWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setShowDeleteWorkspaceModal(false)}
            aria-hidden="true"
          />
          <div className="modal-panel relative z-50 w-full max-w-md rounded-3xl border border-danger/40 bg-sidebar p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-danger/20 text-danger">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Delete Workspace Data?</h3>
                <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                  This simulates wiping local ChromaDB vectors, SQLite databases, and cached audit traces for the Autonomous Sensor Network project.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteWorkspaceModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowDeleteWorkspaceModal(false)
                  showToast("Workspace data reset simulated")
                }}
                className="text-xs"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
