export interface SourceItem {
  id: string
  citationId: string
  filename: string
  date: string
  status: "Previous Source" | "Current Source" | "Conflicting Source"
  passage: string
  highlightPhrases?: string[]
}

export interface SuggestedAction {
  title: string
  description: string
  steps: string[]
  status: "NOT EXECUTED" | "PENDING_REVIEW" | "REJECTED"
}

export interface AskQueryState {
  id: string
  userQuestion: string
  answerParagraphs: string[]
  currentDecision: {
    title: string
    value: string
  }
  previousDecision?: {
    value: string
  }
  reasonForChange?: string
  effectiveDate: string
  status: "CURRENT" | "CONFLICT"
  sources: SourceItem[]
  evidenceStrength: {
    level: "HIGH" | "MEDIUM" | "CONFLICT"
    reason: string
  }
  reasoningTrace: string[]
  suggestedAction?: SuggestedAction
}

export const askQuestionsData: Record<string, AskQueryState> = {
  "demo-date": {
    id: "demo-date",
    userQuestion: "Why was the demo moved?",
    answerParagraphs: [
      "The demo was moved from 7 October to 9 October because sensor delivery was delayed.",
      "The revised meeting note from 21 September explicitly replaces the original project plan from 19 September.",
    ],
    currentDecision: {
      title: "Demo Date",
      value: "9 October",
    },
    previousDecision: {
      value: "7 October",
    },
    reasonForChange: "Sensor delivery delayed",
    effectiveDate: "21 September",
    status: "CURRENT",
    sources: [
      {
        id: "s1",
        citationId: "S1",
        filename: "Project_Plan.pdf",
        date: "19 Sep",
        status: "Previous Source",
        passage: "Demo scheduled for 7 October.",
        highlightPhrases: ["7 October"],
      },
      {
        id: "s2",
        citationId: "S2",
        filename: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        status: "Current Source",
        passage: "Demo rescheduled to 9 October due to delayed sensor delivery.",
        highlightPhrases: ["9 October", "delayed sensor delivery"],
      },
    ],
    evidenceStrength: {
      level: "HIGH",
      reason:
        "Two dated sources clearly show that the newer decision replaces the earlier one.",
    },
    reasoningTrace: [
      "Found the original demo decision in Project_Plan.pdf",
      "Found a newer dated decision in Meeting_Update_21Sep.pdf",
      "Detected that the newer note explicitly changed the date",
      "Linked the change to the reason: delayed sensor delivery",
      "Marked 9 October as the current decision",
    ],
    suggestedAction: {
      title: "Update Demo Plan",
      description:
        "OwnMind detected that the demo date changed from 7 October to 9 October.",
      steps: [
        "Update project timeline",
        "Create demo preparation task",
        "Save revised project brief",
      ],
      status: "NOT EXECUTED",
    },
  },

  "backend-framework": {
    id: "backend-framework",
    userQuestion: "Why did we switch from Flask to FastAPI?",
    answerParagraphs: [
      "We switched from Flask to FastAPI because FastAPI provides better compatibility with the Python AI services pipeline and native asynchronous request handling.",
      "The architecture notes from 20 September explicitly supersede the original draft specification from 18 September.",
    ],
    currentDecision: {
      title: "Backend Framework",
      value: "FastAPI",
    },
    previousDecision: {
      value: "Flask",
    },
    reasonForChange: "Better compatibility with Python AI services",
    effectiveDate: "20 September",
    status: "CURRENT",
    sources: [
      {
        id: "s1",
        citationId: "S1",
        filename: "Architecture_Draft.pdf",
        date: "18 Sep",
        status: "Previous Source",
        passage: "Flask selected for initial microservice prototype.",
        highlightPhrases: ["Flask selected"],
      },
      {
        id: "s2",
        citationId: "S2",
        filename: "Architecture_Notes.pdf",
        date: "20 Sep",
        status: "Current Source",
        passage:
          "FastAPI selected for production backend due to better compatibility with Python AI services and OpenAPI support.",
        highlightPhrases: ["FastAPI selected", "better compatibility with Python AI services"],
      },
    ],
    evidenceStrength: {
      level: "HIGH",
      reason:
        "Architecture Notes on 20 Sep directly supersede Architecture Draft from 18 Sep with team consensus.",
    },
    reasoningTrace: [
      "Found original framework selection (Flask) in Architecture_Draft.pdf",
      "Identified subsequent evaluation and selection in Architecture_Notes.pdf",
      "Detected explicit superseding criteria: async I/O & Python AI compatibility",
      "Confirmed no conflicting downstream constraints in codebase specs",
      "Marked FastAPI as the authoritative backend framework",
    ],
    suggestedAction: {
      title: "Update Architecture Specs",
      description:
        "OwnMind detected framework transition from Flask to FastAPI.",
      steps: [
        "Update API contract documentation",
        "Generate FastAPI boilerplate with Pydantic v2",
        "Notify backend squad of async conventions",
      ],
      status: "NOT EXECUTED",
    },
  },

  "deployment-conflict": {
    id: "deployment-conflict",
    userQuestion: "Are there any unresolved conflicts?",
    answerParagraphs: [
      "Yes, OwnMind detected 1 unresolved decision conflict regarding Deployment Method.",
      "Infra_Plan.pdf specifies local deployment via Docker, whereas DevOps_Meeting_22Sep.pdf mandates deploying using a cloud VM. Both sources possess equal authority weighting.",
    ],
    currentDecision: {
      title: "Deployment Method",
      value: "Unresolved Conflict (Docker vs Cloud VM)",
    },
    previousDecision: {
      value: "Ambiguous Source Priority",
    },
    reasonForChange: "Contradictory directives in simultaneous authoritative channels",
    effectiveDate: "22 September",
    status: "CONFLICT",
    sources: [
      {
        id: "s1",
        citationId: "S1",
        filename: "Infra_Plan.pdf",
        date: "21 Sep",
        status: "Conflicting Source",
        passage: "Deploy locally using Docker container stack for sovereign security.",
        highlightPhrases: ["Deploy locally using Docker"],
      },
      {
        id: "s2",
        citationId: "S2",
        filename: "DevOps_Meeting_22Sep.pdf",
        date: "22 Sep",
        status: "Conflicting Source",
        passage: "Deploy using cloud VM for scalable team-wide evaluation access.",
        highlightPhrases: ["Deploy using cloud VM"],
      },
    ],
    evidenceStrength: {
      level: "CONFLICT",
      reason:
        "OwnMind found two valid sources and cannot determine which decision is current. Human resolution required.",
    },
    reasoningTrace: [
      "Extracted deployment directive from Infra_Plan.pdf (Docker)",
      "Extracted contradictory directive from DevOps_Meeting_22Sep.pdf (Cloud VM)",
      "Evaluated source authority: both documents originate from authorized leads",
      "Determined ambiguity threshold exceeded — automated resolution halted",
      "Flagged as active conflict requiring human-in-the-loop review",
    ],
    suggestedAction: {
      title: "Resolve Deployment Conflict",
      description:
        "Choose between local Docker container or Cloud VM deployment.",
      steps: [
        "Review security implications of cloud VM vs air-gapped local",
        "Convene DevOps sync with Priya Sharma and Daniel Koch",
        "Record authoritative decision in Decisions page",
      ],
      status: "NOT EXECUTED",
    },
  },

  "next-actions": {
    id: "next-actions",
    userQuestion: "What should we do next?",
    answerParagraphs: [
      "Based on recent decision changes and indexed memory, there are 2 high-priority pending actions:",
      "1. Align the Demo Preparation timeline to the revised 9 October date.\n2. Resolve the open deployment conflict between Docker local and Cloud VM.",
    ],
    currentDecision: {
      title: "Project Priority",
      value: "Demo Schedule & Deployment Alignment",
    },
    previousDecision: {
      value: "Prior Baseline (7 October Target)",
    },
    reasonForChange: "Downstream impact of delayed sensor deliveries",
    effectiveDate: "24 September",
    status: "CURRENT",
    sources: [
      {
        id: "s1",
        citationId: "S1",
        filename: "Meeting_Update_21Sep.pdf",
        date: "21 Sep",
        status: "Current Source",
        passage: "Demo rescheduled to 9 October due to delayed sensor delivery.",
        highlightPhrases: ["9 October", "delayed sensor delivery"],
      },
      {
        id: "s2",
        citationId: "S2",
        filename: "Sprint_Backlog.pdf",
        date: "23 Sep",
        status: "Current Source",
        passage: "Pending sign-off on infra deployment architecture before integration demo.",
        highlightPhrases: ["Pending sign-off on infra deployment"],
      },
    ],
    evidenceStrength: {
      level: "HIGH",
      reason:
        "Synthesized from active decision changes and pending audit log action items.",
    },
    reasoningTrace: [
      "Scanned unresolved project tasks across 24 indexed documents",
      "Correlated sensor delivery impact against demo milestone",
      "Checked status of open conflicts: Deployment Method remains unassigned",
      "Ranked actions by critical path timeline urgency",
      "Proposed execution steps with minimal dependency friction",
    ],
    suggestedAction: {
      title: "Execute Demo Preparation Workflow",
      description:
        "Coordinate sensor delivery verification with the hardware vendor.",
      steps: [
        "Confirm carrier tracking for sensor batch #B42",
        "Notify stakeholders of revised 9 October schedule",
        "Prepare staging environment validation checklist",
      ],
      status: "NOT EXECUTED",
    },
  },
}

export const sampleSuggestions = [
  { label: "What changed in our demo plan?", queryKey: "demo-date" },
  { label: "Why did we switch from Flask to FastAPI?", queryKey: "backend-framework" },
  { label: "Are there any unresolved conflicts?", queryKey: "deployment-conflict" },
  { label: "What should we do next?", queryKey: "next-actions" },
]
