export type EventType =
  | "Action Executed"
  | "Action Proposed"
  | "Decision Updated"
  | "Action Rejected"
  | "Source Indexed"
  | "Conflict Detected"
  | "Memory Updated"

export type StatusCategory =
  | "APPROVED"
  | "REJECTED"
  | "PENDING"
  | "DECISION_UPDATE"
  | "CONFLICT"

export interface SourceProvenance {
  source: string
  date: string
  note: string
}

export interface ApprovalTrace {
  aiProposed: boolean
  policyCheck: boolean
  policyCheckText?: string
  userReview: "Approved" | "Rejected" | "Waiting" | "System" | "N/A"
  execution: "Completed" | "No action taken" | "Not Executed" | "Indexed" | "Flagged" | "Pending"
}

export interface AuditRecord {
  id: string
  time: string
  date: string
  event: EventType
  statusCategory: StatusCategory
  relatedDecision: string
  sourceDisplay: string
  sources: SourceProvenance[]
  approvalDisplay: string
  resultDisplay: string
  actionTitle?: string
  previousValue?: string
  currentValue?: string
  reason?: string
  approvalTrace: ApprovalTrace
  tool?: string
  payload?: Record<string, any>
  resultDetails?: string
  recordHash: string
  prevRecordId: string
  timelineOrder?: number
  timelineStepTitle?: string
}

export const auditSummaryStats = {
  total: 18,
  executed: 5,
  rejected: 2,
  decisionUpdates: 11,
}

export const auditRecords: AuditRecord[] = [
  {
    id: "AUD-1024",
    time: "21 Sep • 14:32",
    date: "21 Sep 2026",
    event: "Action Executed",
    statusCategory: "APPROVED",
    relatedDecision: "Demo Date",
    sourceDisplay: "S1, S2",
    sources: [
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
    approvalDisplay: "Approved",
    resultDisplay: "Completed",
    actionTitle: "Update Demo Plan",
    previousValue: "7 October",
    currentValue: "9 October",
    reason: "Sensor delivery delayed",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      policyCheckText: "Passed (5/5 policy checks)",
      userReview: "Approved",
      execution: "Completed",
    },
    tool: "create_task",
    payload: {
      title: "Prepare final demo",
      due_date: "9 October",
      reason: "Demo rescheduled due to sensor delivery delay",
    },
    resultDetails: "Task created successfully in Project Board",
    recordHash: "7F3A...91C2",
    prevRecordId: "AUD-1023",
    timelineOrder: 6,
    timelineStepTitle: "Task executed & audit record created",
  },
  {
    id: "AUD-1023",
    time: "21 Sep • 14:30",
    date: "21 Sep 2026",
    event: "Action Proposed",
    statusCategory: "PENDING",
    relatedDecision: "Demo Date",
    sourceDisplay: "Meeting_Update_21Sep.pdf",
    sources: [
      {
        source: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        note: "Meeting update notes with rescheduled demo milestone",
      },
    ],
    approvalDisplay: "Waiting for approval",
    resultDisplay: "Not Executed",
    actionTitle: "Create Demo Preparation Task",
    previousValue: "None",
    currentValue: "Demo Preparation Dry-run",
    reason: "Demo date moved to 9 October",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      policyCheckText: "Passed",
      userReview: "Waiting",
      execution: "Not Executed",
    },
    tool: "create_task",
    payload: {
      title: "Prepare final demo for 9 October",
      due_date: "8 October",
    },
    resultDetails: "Awaiting explicit human-in-the-loop review",
    recordHash: "9B12...E48A",
    prevRecordId: "AUD-1022",
    timelineOrder: 5,
    timelineStepTitle: "Action proposed to Action Center",
  },
  {
    id: "AUD-1022",
    time: "21 Sep • 14:25",
    date: "21 Sep 2026",
    event: "Decision Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Demo Date",
    sourceDisplay: "Meeting_Update_21Sep.pdf",
    sources: [
      {
        source: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        note: "Section 3.1: Hardware delivery timeline shift",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "7 Oct → 9 Oct",
    actionTitle: "Supersede Demo Milestone",
    previousValue: "7 October",
    currentValue: "9 October",
    reason: "Sensor delivery delayed",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_memory_lineage",
    payload: {
      decision_id: "demo-date",
      old_value: "7 October",
      new_value: "9 October",
      precedence: "supersedes",
    },
    resultDetails: "Decision lineage tree updated with 21 Sep authoritative note",
    recordHash: "3E77...1A09",
    prevRecordId: "AUD-1021",
    timelineOrder: 4,
    timelineStepTitle: "Decision changed: 7 Oct → 9 Oct",
  },
  {
    id: "AUD-1021",
    time: "21 Sep • 14:20",
    date: "21 Sep 2026",
    event: "Source Indexed",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Demo Date",
    sourceDisplay: "Meeting_Update_21Sep.pdf",
    sources: [
      {
        source: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        note: "Newly ingested sync brief from Priya Sharma",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Indexed",
    actionTitle: "Index Meeting Document",
    previousValue: "N/A",
    currentValue: "Meeting_Update_21Sep.pdf (SHA-256 verified)",
    reason: "New project document uploaded by team",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Indexed",
    },
    tool: "index_document",
    payload: {
      filename: "Meeting_Update_21Sep.pdf",
      chunk_count: 14,
      author: "Priya Sharma",
    },
    resultDetails: "Document embedded and linked to Demo Date entity",
    recordHash: "6C21...4F88",
    prevRecordId: "AUD-1020",
    timelineOrder: 3,
    timelineStepTitle: "New meeting note detected & ingested",
  },
  {
    id: "AUD-1020",
    time: "20 Sep • 17:15",
    date: "20 Sep 2026",
    event: "Action Rejected",
    statusCategory: "REJECTED",
    relatedDecision: "Backend Framework",
    sourceDisplay: "Architecture_Notes.pdf",
    sources: [
      {
        source: "Architecture_Notes.pdf",
        date: "20 Sep",
        note: "Team proposed immediate rewrite of legacy router",
      },
    ],
    approvalDisplay: "Rejected by user",
    resultDisplay: "No action taken",
    actionTitle: "Direct Production Framework Cutover",
    previousValue: "Flask",
    currentValue: "FastAPI",
    reason: "User flagged rewrite as needing staged transition instead",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "Rejected",
      execution: "No action taken",
    },
    tool: "trigger_framework_cutover",
    payload: {
      target: "FastAPI",
      instant_switch: true,
    },
    resultDetails: "Rejected by human operator. Zero code modified.",
    recordHash: "4D82...661B",
    prevRecordId: "AUD-1019",
  },
  {
    id: "AUD-1019",
    time: "20 Sep • 17:10",
    date: "20 Sep 2026",
    event: "Decision Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Backend Framework",
    sourceDisplay: "Architecture_Notes.pdf",
    sources: [
      {
        source: "Architecture_Draft.pdf",
        date: "18 Sep",
        note: "Initial proposal: Flask",
      },
      {
        source: "Architecture_Notes.pdf",
        date: "20 Sep",
        note: "Ratified selection: FastAPI",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Flask → FastAPI",
    actionTitle: "Update Architecture Memory",
    previousValue: "Flask",
    currentValue: "FastAPI",
    reason: "Better compatibility with Python AI services",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_memory_lineage",
    payload: {
      decision_id: "backend-framework",
      old_value: "Flask",
      new_value: "FastAPI",
      reason: "Better compatibility with Python AI services",
    },
    resultDetails: "FastAPI recorded as authoritative backend framework",
    recordHash: "1A99...80CC",
    prevRecordId: "AUD-1018",
  },
  {
    id: "AUD-1018",
    time: "20 Sep • 16:40",
    date: "20 Sep 2026",
    event: "Source Indexed",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Backend Framework",
    sourceDisplay: "Architecture_Notes.pdf",
    sources: [
      {
        source: "Architecture_Notes.pdf",
        date: "20 Sep",
        note: "Architecture team evaluation notes",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Indexed",
    actionTitle: "Index Architecture Notes",
    previousValue: "N/A",
    currentValue: "Architecture_Notes.pdf",
    reason: "Engineering sync writeup",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Indexed",
    },
    tool: "index_document",
    payload: {
      filename: "Architecture_Notes.pdf",
      chunk_count: 8,
    },
    resultDetails: "Embedded into vector space with 8 semantic chunks",
    recordHash: "55C0...33AA",
    prevRecordId: "AUD-1017",
  },
  {
    id: "AUD-1017",
    time: "22 Sep • 09:30",
    date: "22 Sep 2026",
    event: "Conflict Detected",
    statusCategory: "CONFLICT",
    relatedDecision: "Deployment Method",
    sourceDisplay: "Infra_Plan.pdf, DevOps_Meeting_22Sep.pdf",
    sources: [
      {
        source: "Infra_Plan.pdf",
        date: "21 Sep",
        note: "Directive: Deploy locally using Docker",
      },
      {
        source: "DevOps_Meeting_22Sep.pdf",
        date: "22 Sep",
        note: "Directive: Deploy using cloud VM",
      },
    ],
    approvalDisplay: "Ambiguity threshold exceeded",
    resultDisplay: "Docker vs Cloud VM",
    actionTitle: "Flag Deployment Conflict",
    previousValue: "Docker (Proposed)",
    currentValue: "Cloud VM (Proposed)",
    reason: "Contradictory directives in simultaneous authoritative channels",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      policyCheckText: "Conflict Detected",
      userReview: "Waiting",
      execution: "Flagged",
    },
    tool: "flag_decision_conflict",
    payload: {
      entity: "Deployment Method",
      competing_sources: ["Infra_Plan.pdf", "DevOps_Meeting_22Sep.pdf"],
      auto_resolve: false,
    },
    resultDetails: "OwnMind halted automatic resolution; human review required",
    recordHash: "8F44...99B1",
    prevRecordId: "AUD-1016",
  },
  {
    id: "AUD-1016",
    time: "22 Sep • 11:15",
    date: "22 Sep 2026",
    event: "Decision Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Data Storage Layer",
    sourceDisplay: "Architecture_Final.pdf",
    sources: [
      {
        source: "Tech_Spec_v2.pdf",
        date: "17 Sep",
        note: "Prior proposal: PostgreSQL with pgvector",
      },
      {
        source: "Architecture_Final.pdf",
        date: "22 Sep",
        note: "Approved: ChromaDB embeddings + Postgres relational",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Postgres → ChromaDB + Postgres",
    actionTitle: "Ratify Hybrid Storage Spec",
    previousValue: "PostgreSQL alone",
    currentValue: "ChromaDB + PostgreSQL hybrid",
    reason: "Satisfies both structured queries and semantic search",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_memory_lineage",
    payload: {
      decision_id: "data-storage",
      old_value: "PostgreSQL alone",
      new_value: "ChromaDB + PostgreSQL hybrid",
    },
    resultDetails: "Hybrid storage spec ratified by architecture board",
    recordHash: "22EA...018F",
    prevRecordId: "AUD-1015",
  },
  {
    id: "AUD-1015",
    time: "21 Sep • 16:00",
    date: "21 Sep 2026",
    event: "Memory Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Vendor Hardware",
    sourceDisplay: "Sensor_Specs_v3.pdf",
    sources: [
      {
        source: "Sensor_Specs_v3.pdf",
        date: "21 Sep",
        note: "Revised serial pinout diagrams",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Batch #B42 Specs",
    actionTitle: "Update Sensor Entity Memory",
    previousValue: "Batch #B40",
    currentValue: "Batch #B42",
    reason: "Manufacturer hardware specification update",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_knowledge_graph",
    payload: {
      entity: "Optical Sensor",
      batch: "B42",
      baud_rate: 115200,
    },
    resultDetails: "Updated pinout and voltage requirements in local knowledge graph",
    recordHash: "991A...FF42",
    prevRecordId: "AUD-1014",
  },
  {
    id: "AUD-1014",
    time: "19 Sep • 11:00",
    date: "19 Sep 2026",
    event: "Source Indexed",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Demo Date",
    sourceDisplay: "Project_Plan.pdf",
    sources: [
      {
        source: "Project_Plan.pdf",
        date: "19 Sep",
        note: "Initial master schedule ratified by PM",
      },
    ],
    approvalDisplay: "N/A",
    resultDisplay: "Indexed",
    actionTitle: "Index Project Plan",
    previousValue: "N/A",
    currentValue: "Project_Plan.pdf",
    reason: "Initial repository setup",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "N/A",
      execution: "Indexed",
    },
    tool: "index_document",
    payload: {
      filename: "Project_Plan.pdf",
      milestones: ["Demo: 7 October", "Sprint Review: 15 October"],
    },
    resultDetails: "Baseline project plan ingested into local memory",
    recordHash: "4401...88AA",
    prevRecordId: "AUD-1013",
    timelineOrder: 1,
    timelineStepTitle: "Project_Plan.pdf indexed (Initial Demo Date: 7 Oct)",
  },
  {
    id: "AUD-1013",
    time: "18 Sep • 15:30",
    date: "18 Sep 2026",
    event: "Decision Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Backend Framework",
    sourceDisplay: "Architecture_Draft.pdf",
    sources: [
      {
        source: "Architecture_Draft.pdf",
        date: "18 Sep",
        note: "Initial microservice draft proposal",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Draft: Flask",
    actionTitle: "Record Initial Framework Draft",
    previousValue: "Unassigned",
    currentValue: "Flask",
    reason: "Lightweight prototyping consideration",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_memory_lineage",
    payload: {
      framework: "Flask",
      scope: "internal prototype",
    },
    resultDetails: "Initial baseline drafted in Architecture space",
    recordHash: "70C9...2155",
    prevRecordId: "AUD-1012",
  },
  {
    id: "AUD-1012",
    time: "18 Sep • 14:00",
    date: "18 Sep 2026",
    event: "Action Executed",
    statusCategory: "APPROVED",
    relatedDecision: "Knowledge Ingestion",
    sourceDisplay: "Architecture_Draft.pdf",
    sources: [
      {
        source: "Architecture_Draft.pdf",
        date: "18 Sep",
        note: "Draft document ready for indexing",
      },
    ],
    approvalDisplay: "Approved",
    resultDisplay: "Completed",
    actionTitle: "Index Architecture Specs",
    previousValue: "Unindexed",
    currentValue: "Indexed",
    reason: "User approved ingest request",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "Approved",
      execution: "Completed",
    },
    tool: "index_document",
    payload: {
      filename: "Architecture_Draft.pdf",
      approved_by: "Project Team",
    },
    resultDetails: "Ingested into local sovereign embeddings store",
    recordHash: "331B...09AE",
    prevRecordId: "AUD-1011",
  },
  {
    id: "AUD-1011",
    time: "17 Sep • 16:45",
    date: "17 Sep 2026",
    event: "Action Executed",
    statusCategory: "APPROVED",
    relatedDecision: "Vendor Dependency",
    sourceDisplay: "Vendor_Contract.pdf",
    sources: [
      {
        source: "Vendor_Contract.pdf",
        date: "17 Sep",
        note: "Signed SLA agreement with sensor distributor",
      },
    ],
    approvalDisplay: "Approved",
    resultDisplay: "Completed",
    actionTitle: "Link Sensor Hardware Vendor Brief",
    previousValue: "Unlinked",
    currentValue: "Vendor SLA Active",
    reason: "Contract executed with hardware supplier",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "Approved",
      execution: "Completed",
    },
    tool: "link_vendor_dependency",
    payload: {
      vendor: "Apex Sensor Corp",
      delivery_lead_time_days: 14,
    },
    resultDetails: "Dependency mapped to Autonomous Sensor Network project",
    recordHash: "88CD...1123",
    prevRecordId: "AUD-1010",
  },
  {
    id: "AUD-1010",
    time: "17 Sep • 10:20",
    date: "17 Sep 2026",
    event: "Decision Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Data Storage Layer",
    sourceDisplay: "Tech_Spec_v2.pdf",
    sources: [
      {
        source: "Tech_Spec_v1.pdf",
        date: "15 Sep",
        note: "Initial spec: SQLite",
      },
      {
        source: "Tech_Spec_v2.pdf",
        date: "17 Sep",
        note: "Revision: PostgreSQL with pgvector",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "SQLite → PostgreSQL",
    actionTitle: "Update Storage Specification",
    previousValue: "SQLite",
    currentValue: "PostgreSQL with pgvector",
    reason: "Need vector search for knowledge retrieval",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_memory_lineage",
    payload: {
      decision_id: "data-storage",
      old_value: "SQLite",
      new_value: "PostgreSQL with pgvector",
    },
    resultDetails: "Updated relational storage requirement to Postgres",
    recordHash: "119A...44C0",
    prevRecordId: "AUD-1009",
  },
  {
    id: "AUD-1009",
    time: "16 Sep • 13:45",
    date: "16 Sep 2026",
    event: "Memory Updated",
    statusCategory: "DECISION_UPDATE",
    relatedDecision: "Team Roles",
    sourceDisplay: "Team_Roster.pdf",
    sources: [
      {
        source: "Team_Roster.pdf",
        date: "16 Sep",
        note: "Roster assignment of Priya Sharma to sensor integration lead",
      },
    ],
    approvalDisplay: "System detected",
    resultDisplay: "Priya Sharma assigned",
    actionTitle: "Update Entity Ownership",
    previousValue: "Unassigned",
    currentValue: "Priya Sharma (Sensor Lead)",
    reason: "Sprint 1 role confirmation",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "System",
      execution: "Completed",
    },
    tool: "update_knowledge_graph",
    payload: {
      person: "Priya Sharma",
      role: "Lead Hardware Engineer",
    },
    resultDetails: "Associated with sensor verification workflow",
    recordHash: "66F1...78B2",
    prevRecordId: "AUD-1008",
  },
  {
    id: "AUD-1008",
    time: "15 Sep • 16:10",
    date: "15 Sep 2026",
    event: "Action Rejected",
    statusCategory: "REJECTED",
    relatedDecision: "Telemetry Protocol",
    sourceDisplay: "Telemetry_Brief.pdf",
    sources: [
      {
        source: "Telemetry_Brief.pdf",
        date: "15 Sep",
        note: "Proposed MQTT cloud broker integration",
      },
    ],
    approvalDisplay: "Rejected by user",
    resultDisplay: "No action taken",
    actionTitle: "Expose Public MQTT Broker Endpoint",
    previousValue: "Local sockets only",
    currentValue: "Public MQTT broker",
    reason: "Violates local-first sovereign air-gap policy",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      policyCheckText: "Policy Alert: External egress",
      userReview: "Rejected",
      execution: "No action taken",
    },
    tool: "configure_network_endpoint",
    payload: {
      endpoint: "mqtt://broker.hivemq.com:1883",
      encrypted: false,
    },
    resultDetails: "Denied by security engineer. Air-gapped boundary preserved.",
    recordHash: "99A0...33B1",
    prevRecordId: "AUD-1007",
  },
  {
    id: "AUD-1007",
    time: "15 Sep • 09:00",
    date: "15 Sep 2026",
    event: "Action Executed",
    statusCategory: "APPROVED",
    relatedDecision: "Workspace Initialization",
    sourceDisplay: "Project_Charter.pdf",
    sources: [
      {
        source: "Project_Charter.pdf",
        date: "15 Sep",
        note: "Initial workspace governance charter",
      },
    ],
    approvalDisplay: "Approved",
    resultDisplay: "Completed",
    actionTitle: "Initialize Sovereign Workspace Vault",
    previousValue: "Uninitialized",
    currentValue: "OwnMind Local Vault Active",
    reason: "Project kickoff",
    approvalTrace: {
      aiProposed: true,
      policyCheck: true,
      userReview: "Approved",
      execution: "Completed",
    },
    tool: "init_vault",
    payload: {
      workspace_name: "Autonomous Sensor Network",
      mode: "local-first-private",
    },
    resultDetails: "Encrypted sqlite/vector storage roots initialized",
    recordHash: "001A...99FF",
    prevRecordId: "GENESIS",
  },
]
