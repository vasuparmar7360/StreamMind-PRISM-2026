export type DecisionStatus = "CURRENT" | "REPLACED" | "CONFLICT"

export interface DecisionEntry {
  date: string
  dateShort: string
  label: string
  source: string
  status: DecisionStatus
  reason?: string
}

export interface DecisionLineage {
  id: string
  topic: string
  category: string
  entries: DecisionEntry[]
}

export interface ConflictDecision {
  id: string
  topic: string
  sourceA: { label: string; source: string }
  sourceB: { label: string; source: string }
}

export interface DecisionDetail {
  id: string
  topic: string
  current: DecisionEntry
  previous?: DecisionEntry
  relatedPeople: string[]
  relatedProject: string
  actionHistory: { label: string; status: "done" | "pending" | "waiting" }[]
}

// ─── Timeline lineages ──────────────────────────────────────────────────────

export const decisionLineages: DecisionLineage[] = [
  {
    id: "demo-date",
    topic: "Demo Date",
    category: "SCHEDULING",
    entries: [
      {
        date: "19 September 2026",
        dateShort: "19 SEP",
        label: "Demo scheduled for 7 October",
        source: "Project_Plan.pdf",
        status: "REPLACED",
      },
      {
        date: "21 September 2026",
        dateShort: "21 SEP",
        label: "Demo scheduled for 9 October",
        source: "Meeting_Update_21Sep.pdf",
        status: "CURRENT",
        reason: "Sensor delivery delayed",
      },
    ],
  },
  {
    id: "backend-framework",
    topic: "Backend Framework",
    category: "ARCHITECTURE",
    entries: [
      {
        date: "18 September 2026",
        dateShort: "18 SEP",
        label: "Flask selected",
        source: "Architecture_Draft.pdf",
        status: "REPLACED",
      },
      {
        date: "20 September 2026",
        dateShort: "20 SEP",
        label: "FastAPI selected",
        source: "Architecture_Notes.pdf",
        status: "CURRENT",
        reason: "Better compatibility with Python AI services",
      },
    ],
  },
  {
    id: "data-storage",
    topic: "Data Storage Layer",
    category: "ARCHITECTURE",
    entries: [
      {
        date: "15 September 2026",
        dateShort: "15 SEP",
        label: "Use SQLite for local storage",
        source: "Tech_Spec_v1.pdf",
        status: "REPLACED",
      },
      {
        date: "17 September 2026",
        dateShort: "17 SEP",
        label: "Use PostgreSQL with pgvector",
        source: "Tech_Spec_v2.pdf",
        status: "REPLACED",
        reason: "Need vector search for knowledge retrieval",
      },
      {
        date: "22 September 2026",
        dateShort: "22 SEP",
        label: "Use ChromaDB for embeddings + PostgreSQL for structured data",
        source: "Architecture_Final.pdf",
        status: "CURRENT",
        reason: "Hybrid approach satisfies both structured queries and semantic search",
      },
    ],
  },
]

// ─── Conflict decisions ──────────────────────────────────────────────────────

export const conflictDecisions: ConflictDecision[] = [
  {
    id: "deployment-method",
    topic: "Deployment Method",
    sourceA: {
      label: "Deploy locally using Docker",
      source: "Infra_Plan.pdf",
    },
    sourceB: {
      label: "Deploy using cloud VM",
      source: "DevOps_Meeting_22Sep.pdf",
    },
  },
]

// ─── Detail panel data ────────────────────────────────────────────────────────

export const decisionDetails: Record<string, DecisionDetail> = {
  "demo-date": {
    id: "demo-date",
    topic: "Demo Date",
    current: {
      date: "21 September 2026",
      dateShort: "21 SEP",
      label: "Demo scheduled for 9 October",
      source: "Meeting_Update_21Sep.pdf",
      status: "CURRENT",
      reason: "Sensor delivery delayed",
    },
    previous: {
      date: "19 September 2026",
      dateShort: "19 SEP",
      label: "Demo scheduled for 7 October",
      source: "Project_Plan.pdf",
      status: "REPLACED",
    },
    relatedPeople: ["Priya Sharma", "Daniel Koch"],
    relatedProject: "Autonomous Sensor Network",
    actionHistory: [
      { label: "Decision detected", status: "done" },
      { label: "Memory updated", status: "done" },
      { label: "Action proposed", status: "done" },
      { label: "Waiting for approval", status: "waiting" },
    ],
  },
  "backend-framework": {
    id: "backend-framework",
    topic: "Backend Framework",
    current: {
      date: "20 September 2026",
      dateShort: "20 SEP",
      label: "FastAPI selected",
      source: "Architecture_Notes.pdf",
      status: "CURRENT",
      reason: "Better compatibility with Python AI services",
    },
    previous: {
      date: "18 September 2026",
      dateShort: "18 SEP",
      label: "Flask selected",
      source: "Architecture_Draft.pdf",
      status: "REPLACED",
    },
    relatedPeople: ["Riya Mehta", "Carlos Delgado"],
    relatedProject: "Autonomous Sensor Network",
    actionHistory: [
      { label: "Decision detected", status: "done" },
      { label: "Memory updated", status: "done" },
      { label: "Action proposed", status: "pending" },
      { label: "Waiting for approval", status: "waiting" },
    ],
  },
  "data-storage": {
    id: "data-storage",
    topic: "Data Storage Layer",
    current: {
      date: "22 September 2026",
      dateShort: "22 SEP",
      label: "ChromaDB + PostgreSQL hybrid",
      source: "Architecture_Final.pdf",
      status: "CURRENT",
      reason: "Hybrid satisfies both structured queries and semantic search",
    },
    previous: {
      date: "17 September 2026",
      dateShort: "17 SEP",
      label: "PostgreSQL with pgvector",
      source: "Tech_Spec_v2.pdf",
      status: "REPLACED",
    },
    relatedPeople: ["Riya Mehta"],
    relatedProject: "Autonomous Sensor Network",
    actionHistory: [
      { label: "Decision detected", status: "done" },
      { label: "Memory updated", status: "done" },
      { label: "Action proposed", status: "pending" },
      { label: "Waiting for approval", status: "waiting" },
    ],
  },
}

// ─── Summary stats ────────────────────────────────────────────────────────────

export const decisionStats = [
  { value: "12", label: "Active Decisions", accent: "cyan" as const },
  { value: "7", label: "Replaced Decisions", accent: "blue" as const },
  { value: "2", label: "Conflicts Detected", accent: "conflict" as const },
  { value: "18", label: "Source Links", accent: "purple" as const },
]
