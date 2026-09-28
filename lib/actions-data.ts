export type RiskLevel = "LOW" | "MEDIUM" | "HIGH"
export type ActionStatus = "WAITING_APPROVAL" | "EXECUTED" | "REJECTED"

export interface ActionItem {
  id: string
  title: string
  status: ActionStatus
  reason: string
  evidence: {
    source: string
    date: string
    note: string
  }[]
  proposedChanges: string[]
  riskLevel: RiskLevel
  policyChecks: {
    rule: string
    passed: boolean
  }[]
  tool: string
  requestedBy: string
  payload: Record<string, string | number | boolean | string[]>
  taskSummary?: string
  suggestedDueDate?: string
  executionResult?: string
  auditId?: string
  rejectionReason?: string
}

export interface ActionHistoryRecord {
  id: string
  time: string
  action: string
  decision: string
  approval: "Approved" | "Rejected"
  result: "Completed" | "No action taken"
  auditId: string
  riskLevel: RiskLevel
}

export const initialSummaryStats = {
  pending: 2,
  approvedToday: 3,
  rejected: 1,
  completed: 5,
}

export const initialPendingActions: ActionItem[] = [
  {
    id: "act-demo-plan",
    title: "Update Demo Plan",
    status: "WAITING_APPROVAL",
    reason: "OwnMind detected that the demo date changed from 7 October to 9 October.",
    evidence: [
      {
        source: "Project_Plan.pdf",
        date: "19 Sep",
        note: "Previous decision: Demo 7 October",
      },
      {
        source: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        note: "Current decision: Demo 9 October",
      },
    ],
    proposedChanges: [
      "Update project timeline",
      "Set current demo date to 9 October",
      "Save the reason: Sensor delivery delayed",
      "Create a preparation task",
    ],
    riskLevel: "LOW",
    policyChecks: [
      { rule: "Tool is allowed", passed: true },
      { rule: "Workspace scope valid", passed: true },
      { rule: "Required fields present", passed: true },
      { rule: "No duplicate action detected", passed: true },
      { rule: "User approval required", passed: true },
    ],
    tool: "create_task",
    requestedBy: "OwnMind AI",
    payload: {
      title: "Prepare final demo",
      due_date: "9 October",
      reason: "Demo rescheduled due to sensor delivery delay",
    },
    auditId: "AUD-1024",
  },
  {
    id: "act-demo-prep-task",
    title: "Create Demo Preparation Task",
    status: "WAITING_APPROVAL",
    taskSummary: "Prepare final demo for 9 October",
    suggestedDueDate: "8 October",
    reason: "Demo date changed",
    evidence: [
      {
        source: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        note: "Current authoritative milestone: 9 October",
      },
    ],
    proposedChanges: [
      "Create backlog preparation sub-task",
      "Set milestone target to 8 October (1 day prior to demo)",
      "Assign owner: Engineering Team",
    ],
    riskLevel: "LOW",
    policyChecks: [
      { rule: "Tool is allowed", passed: true },
      { rule: "Workspace scope valid", passed: true },
      { rule: "Required fields present", passed: true },
      { rule: "No duplicate action detected", passed: true },
      { rule: "User approval required", passed: true },
    ],
    tool: "create_task",
    requestedBy: "OwnMind AI",
    payload: {
      title: "Demo preparation dry-run & sensor validation",
      due_date: "8 October",
      priority: "high",
      assignee_group: "engineering",
    },
    auditId: "AUD-1025",
  },
  {
    id: "act-db-migration",
    title: "Migrate Vector Schema to ChromaDB",
    status: "WAITING_APPROVAL",
    taskSummary: "Deprecate legacy SQLite table indices in favor of hybrid ChromaDB + Postgres",
    suggestedDueDate: "Immediate",
    reason: "Architecture specification change on 22 Sep",
    evidence: [
      {
        source: "Architecture_Final.pdf",
        date: "22 Sep",
        note: "Hybrid storage spec ratified by architecture board",
      },
    ],
    proposedChanges: [
      "Re-index 24 local project documents into ChromaDB",
      "Archive old SQLite relational indexes",
      "Update database connection config",
    ],
    riskLevel: "HIGH",
    policyChecks: [
      { rule: "Tool is allowed", passed: true },
      { rule: "Workspace scope valid", passed: true },
      { rule: "Required fields present", passed: true },
      { rule: "High-risk flag: Data schema modification", passed: true },
      { rule: "User approval required (Manual confirmation)", passed: true },
    ],
    tool: "migrate_database",
    requestedBy: "OwnMind AI",
    payload: {
      action: "migrate_vector_store",
      target_engine: "ChromaDB",
      backup_before_run: true,
      dry_run: false,
    },
    auditId: "AUD-1026",
  },
]

export const initialHistoryRecords: ActionHistoryRecord[] = [
  {
    id: "hist-1",
    time: "21 Sep 14:32",
    action: "Update Demo Plan",
    decision: "Demo Date",
    approval: "Approved",
    result: "Completed",
    auditId: "AUD-1020",
    riskLevel: "LOW",
  },
  {
    id: "hist-2",
    time: "21 Sep 14:30",
    action: "Create Demo Task",
    decision: "Demo Date",
    approval: "Approved",
    result: "Completed",
    auditId: "AUD-1019",
    riskLevel: "LOW",
  },
  {
    id: "hist-3",
    time: "20 Sep 17:15",
    action: "Change Backend Framework",
    decision: "Backend Framework",
    approval: "Rejected",
    result: "No action taken",
    auditId: "AUD-1018",
    riskLevel: "MEDIUM",
  },
  {
    id: "hist-4",
    time: "18 Sep 09:12",
    action: "Index Architecture Specs",
    decision: "Knowledge Ingestion",
    approval: "Approved",
    result: "Completed",
    auditId: "AUD-1017",
    riskLevel: "LOW",
  },
  {
    id: "hist-5",
    time: "17 Sep 16:45",
    action: "Link Sensor Hardware Vendor Brief",
    decision: "Vendor Dependency",
    approval: "Approved",
    result: "Completed",
    auditId: "AUD-1016",
    riskLevel: "LOW",
  },
]
