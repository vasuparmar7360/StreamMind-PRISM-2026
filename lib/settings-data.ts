export interface ModelOption {
  id: string
  name: string
  parameterSize: string
  runtime: string
  type: string
  active: boolean
  description: string
}

export interface MemoryItem {
  id: string
  tab: "Facts" | "Decisions" | "People" | "Projects" | "Preferences"
  type: "Decision" | "Project Fact" | "Person Entity" | "Project Scope" | "User Preference"
  memory: string
  source: string
  created: string
  replaces?: string
  status: "ACTIVE" | "SUPERSEDED" | "CONFLICT"
  previousMemory?: string
  previousSource?: string
  reasonForChange?: string
  linkedDecision?: string
  linkedActions?: string[]
  historySteps: {
    date: string
    text: string
  }[]
}

export interface ToolPermission {
  id: string
  name: string
  description: string
  enabled: boolean
  scope: string
  requiresApproval: boolean
  allowAutomaticExecution: boolean
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
}

export const initialModels: ModelOption[] = [
  {
    id: "qwen3-4b",
    name: "Qwen3 4B",
    parameterSize: "4.1B",
    runtime: "Ollama (v0.5.2)",
    type: "Local GGUF Q4_K_M",
    active: true,
    description: "Primary sovereign reasoning engine. Optimized for low-latency decision lineage tracing.",
  },
  {
    id: "llama-3-3b",
    name: "Llama 3.2 3B",
    parameterSize: "3.2B",
    runtime: "Ollama",
    type: "Local GGUF Q4_K_M",
    active: false,
    description: "Fast conversational assistant with strong factual grounding.",
  },
  {
    id: "mistral-7b",
    name: "Mistral 7B Instruct",
    parameterSize: "7.2B",
    runtime: "Local llama.cpp",
    type: "Local GGUF Q5_K_M",
    active: false,
    description: "Higher capacity model for complex architecture trade-off synthesis.",
  },
  {
    id: "custom-local",
    name: "Custom Local Model",
    parameterSize: "Configurable",
    runtime: "OpenAI-compatible HTTP Endpoint",
    type: "Local API (127.0.0.1:11434)",
    active: false,
    description: "Connect to LM Studio, vLLM, or any private air-gapped OpenAI-compatible endpoint.",
  },
]

export const initialMemorySummary = {
  total: 41,
  activeDecisions: 12,
  historicalDecisions: 7,
  conflicts: 2,
}

export const initialMemories: MemoryItem[] = [
  {
    id: "mem-1",
    tab: "Decisions",
    type: "Decision",
    memory: "Demo date is 9 October",
    source: "Meeting_Update_21Sep.pdf",
    created: "21 Sep",
    replaces: "Demo date was 7 October",
    status: "ACTIVE",
    previousMemory: "Demo date was 7 October",
    previousSource: "Project_Plan.pdf",
    reasonForChange: "Sensor delivery delayed",
    linkedDecision: "Demo Date",
    linkedActions: ["Update Demo Plan", "Create Demo Preparation Task"],
    historySteps: [
      { date: "19 Sep", text: "7 October stored from Project_Plan.pdf" },
      { date: "21 Sep", text: "9 October stored from Meeting_Update_21Sep.pdf" },
      { date: "21 Sep", text: "Previous memory marked as replaced" },
    ],
  },
  {
    id: "mem-2",
    tab: "Decisions",
    type: "Decision",
    memory: "Backend framework is FastAPI",
    source: "Architecture_Notes.pdf",
    created: "20 Sep",
    replaces: "Flask",
    status: "ACTIVE",
    previousMemory: "Flask selected for core REST API routing",
    previousSource: "Architecture_Draft.pdf",
    reasonForChange: "Better compatibility with Python AI services",
    linkedDecision: "Backend Framework",
    linkedActions: ["Update API Documentation"],
    historySteps: [
      { date: "18 Sep", text: "Flask recorded as draft framework" },
      { date: "20 Sep", text: "FastAPI selected and verified with Python AI pipeline" },
      { date: "20 Sep", text: "Previous memory marked as replaced" },
    ],
  },
  {
    id: "mem-3",
    tab: "Facts",
    type: "Project Fact",
    memory: "OwnMind AI uses local-first inference with zero cloud egress",
    source: "Architecture_Final.pdf",
    created: "22 Sep",
    status: "ACTIVE",
    linkedDecision: "Inference Architecture",
    historySteps: [
      { date: "22 Sep", text: "Ingested from Architecture_Final.pdf section 2" },
      { date: "22 Sep", text: "Validated against local Ollama configuration" },
    ],
  },
  {
    id: "mem-4",
    tab: "Facts",
    type: "Project Fact",
    memory: "Optical sensor batch #B42 requires 115200 baud UART serial interface",
    source: "Sensor_Specs_v3.pdf",
    created: "21 Sep",
    status: "ACTIVE",
    linkedDecision: "Vendor Hardware",
    historySteps: [
      { date: "21 Sep", text: "Extracted from hardware pinout diagram v3" },
    ],
  },
  {
    id: "mem-5",
    tab: "People",
    type: "Person Entity",
    memory: "Priya Sharma is the Lead Hardware Engineer responsible for sensor delivery",
    source: "Team_Roster.pdf",
    created: "16 Sep",
    status: "ACTIVE",
    linkedDecision: "Team Roles",
    linkedActions: ["Notify hardware squad of demo revision"],
    historySteps: [
      { date: "16 Sep", text: "Assigned role in Sprint 1 Kickoff" },
    ],
  },
  {
    id: "mem-6",
    tab: "People",
    type: "Person Entity",
    memory: "Daniel Koch coordinates project delivery and infrastructure provisioning",
    source: "Team_Roster.pdf",
    created: "16 Sep",
    status: "ACTIVE",
    linkedDecision: "Team Roles",
    historySteps: [
      { date: "16 Sep", text: "Identified as primary contact for demo operations" },
    ],
  },
  {
    id: "mem-7",
    tab: "Projects",
    type: "Project Scope",
    memory: "Autonomous Sensor Network targets air-gapped edge telemetry deployment",
    source: "Project_Charter.pdf",
    created: "15 Sep",
    status: "ACTIVE",
    linkedDecision: "Workspace Initialization",
    historySteps: [
      { date: "15 Sep", text: "Project Charter ingested at workspace initialization" },
    ],
  },
  {
    id: "mem-8",
    tab: "Preferences",
    type: "User Preference",
    memory: "Strict human approval required before any external filesystem write",
    source: "Workspace_Config.json",
    created: "15 Sep",
    status: "ACTIVE",
    historySteps: [
      { date: "15 Sep", text: "Default sovereign governance profile configured" },
    ],
  },
]

export const initialTools: ToolPermission[] = [
  {
    id: "create_task",
    name: "create_task",
    description: "Generate project tasks, preparation checklists, and milestone reminders.",
    enabled: true,
    scope: "Selected Workspace Only",
    requiresApproval: true,
    allowAutomaticExecution: false,
    riskLevel: "LOW",
  },
  {
    id: "save_brief",
    name: "save_brief",
    description: "Store structured meeting syntheses, architecture notes, and decision briefs.",
    enabled: true,
    scope: "Selected Workspace Only",
    requiresApproval: true,
    allowAutomaticExecution: false,
    riskLevel: "LOW",
  },
  {
    id: "update_project_plan",
    name: "update_project_plan",
    description: "Modify master project schedules, Gantt charts, and phase milestones.",
    enabled: false,
    scope: "Selected Workspace Only",
    requiresApproval: true,
    allowAutomaticExecution: false,
    riskLevel: "MEDIUM",
  },
  {
    id: "migrate_database",
    name: "migrate_database",
    description: "Perform schema alterations, vector re-indexing, or relational table migrations.",
    enabled: false,
    scope: "Selected Workspace Only",
    requiresApproval: true,
    allowAutomaticExecution: false,
    riskLevel: "HIGH",
  },
]

export const initialExecutionPolicies = {
  requireApproval: true,
  blockDuplicates: true,
  rejectWithoutEvidence: true,
  highRiskManualConfirmation: true,
  allowBackgroundAutomatic: false,
}

export const initialPrivacyCards = [
  {
    label: "Local Inference",
    status: "ACTIVE",
    badge: "emerald",
    detail: "Executed entirely on local GPU/CPU with Ollama",
  },
  {
    label: "Cloud AI Calls",
    status: "DISABLED",
    badge: "muted",
    detail: "Zero network sockets opened to external LLM providers",
  },
  {
    label: "Project Data Location",
    status: "Local Device",
    badge: "cyan",
    detail: "Indexed vectors and sqlite DB stored in local directory",
  },
  {
    label: "Outbound Telemetry",
    status: "DISABLED",
    badge: "muted",
    detail: "No analytics or behavioral data sent outside this machine",
  },
  {
    label: "Knowledge Database",
    status: "Local",
    badge: "cyan",
    detail: "ChromaDB + SQLite private storage vault",
  },
]
