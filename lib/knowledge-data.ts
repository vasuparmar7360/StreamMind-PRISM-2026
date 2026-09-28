export type KnowledgeDocument = {
  id: string
  filename: string
  category: "PDF" | "Meeting Notes" | "Technical" | "Research" | "Notes"
  added: string
  addedDay: number
  updated?: boolean
  factCount: number
  decisionCount: number
  insight: string
  people: string[]
  dates: string[]
  facts: string[]
  decision: {
    label: string
    value: string
    status: "current" | "replaced"
    previous?: string
    reason: string
    relatedReason: string
  }
  linkedSourceId: string
  excerpt: string
  highlights: string[]
}

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "SRC-019",
    filename: "Project_Plan.pdf",
    category: "PDF",
    added: "19 Sep",
    addedDay: 19,
    factCount: 12,
    decisionCount: 3,
    insight: "Project milestones, ownership, and the original demo timeline.",
    people: ["Vasu", "Vedant"],
    dates: ["19 Sep", "7 October"],
    facts: [
      "The original project demo was planned for 7 October",
      "Sensor integration is required before the demo",
      "The project plan defines the initial delivery milestones",
    ],
    decision: {
      label: "Demo Date",
      value: "7 October",
      status: "replaced",
      reason: "Superseded by the 21 Sep meeting update after a sensor delivery delay.",
      relatedReason: "Original Project Schedule",
    },
    linkedSourceId: "SRC-021",
    excerpt: "The project demo is planned for 7 October, with sensor integration completed before the demonstration.",
    highlights: ["7 October", "sensor integration"],
  },
  {
    id: "SRC-021",
    filename: "Meeting_Update_21Sep.pdf",
    category: "Meeting Notes",
    added: "21 Sep",
    addedDay: 21,
    updated: true,
    factCount: 8,
    decisionCount: 2,
    insight: "Demo rescheduled to 9 October after a sensor delivery delay.",
    people: ["Vasu", "Vedant"],
    dates: ["21 Sep", "9 October"],
    facts: [
      "Sensor delivery was delayed",
      "Demo date changed",
      "Demo preparation must be updated",
    ],
    decision: {
      label: "Demo Date",
      value: "9 October",
      status: "current",
      previous: "7 October",
      reason: "Sensor delivery delayed",
      relatedReason: "Sensor Delivery Delay",
    },
    linkedSourceId: "SRC-019",
    excerpt: "The project demo has been rescheduled to 9 October due to delayed sensor delivery.",
    highlights: ["9 October", "delayed sensor delivery"],
  },
  {
    id: "SRC-020",
    filename: "Architecture_Notes.pdf",
    category: "Technical",
    added: "20 Sep",
    addedDay: 20,
    factCount: 15,
    decisionCount: 4,
    insight: "Local-first architecture, model selection, and data boundaries.",
    people: ["Vedant"],
    dates: ["20 Sep"],
    facts: [
      "Project documents stay on the local device",
      "Qwen3 4B is the selected local reasoning model",
      "Extracted decisions retain references to their source documents",
    ],
    decision: {
      label: "AI Deployment",
      value: "Local-first inference",
      status: "current",
      reason: "Keep sensitive project knowledge within the device boundary.",
      relatedReason: "Project Data Privacy",
    },
    linkedSourceId: "SRC-018",
    excerpt: "OwnMind AI uses local-first inference with Qwen3 4B to keep project knowledge on the device.",
    highlights: ["local-first inference", "Qwen3 4B"],
  },
  {
    id: "SRC-018",
    filename: "Research_Notes.pdf",
    category: "Research",
    added: "18 Sep",
    addedDay: 18,
    factCount: 20,
    decisionCount: 1,
    insight: "Research findings behind traceable, source-backed answers.",
    people: ["Vasu"],
    dates: ["18 Sep"],
    facts: [
      "Project teams need to trace decisions back to original evidence",
      "Local models can support private project knowledge retrieval",
      "Source references help distinguish current and outdated decisions",
    ],
    decision: {
      label: "Knowledge Retrieval",
      value: "Source-backed retrieval",
      status: "current",
      reason: "Make project knowledge explainable and verifiable.",
      relatedReason: "Traceable Project Evidence",
    },
    linkedSourceId: "SRC-020",
    excerpt: "Source-backed retrieval connects each project answer to original evidence, making decisions traceable and verifiable.",
    highlights: ["Source-backed retrieval", "original evidence"],
  },
  {
    id: "SRC-022",
    filename: "Demo_Tasks.txt",
    category: "Notes",
    added: "22 Sep",
    addedDay: 22,
    factCount: 6,
    decisionCount: 1,
    insight: "Preparation tasks aligned with the updated 9 October demo.",
    people: ["Vasu", "Vedant"],
    dates: ["22 Sep", "9 October"],
    facts: [
      "Demo preparation must follow the revised 9 October date",
      "The sensor integration checklist needs to be reviewed",
      "The final rehearsal depends on sensor delivery",
    ],
    decision: {
      label: "Demo Preparation",
      value: "Update the task checklist",
      status: "current",
      reason: "Align preparation with the revised project demo date.",
      relatedReason: "Revised Demo Timeline",
    },
    linkedSourceId: "SRC-021",
    excerpt: "Update the task checklist for the 9 October demo and confirm sensor integration before the final rehearsal.",
    highlights: ["Update the task checklist", "9 October"],
  },
]

export const knowledgeFilters = ["All Files", "PDF", "Notes", "Technical", "Meeting", "Recently Updated"] as const
export type KnowledgeFilter = (typeof knowledgeFilters)[number]

export function filterKnowledge(query: string, filter: KnowledgeFilter) {
  const search = query.trim().toLocaleLowerCase()
  const result = knowledgeDocuments.filter((document) => {
    const matchesFilter =
      filter === "All Files" ||
      (filter === "PDF" && document.filename.endsWith(".pdf")) ||
      (filter === "Notes" && ["Notes", "Meeting Notes"].includes(document.category)) ||
      (filter === "Technical" && document.category === "Technical") ||
      (filter === "Meeting" && document.category === "Meeting Notes") ||
      (filter === "Recently Updated" && document.updated === true)
    const searchableContent = [
      document.filename, document.category, document.id, document.insight,
      ...document.facts, ...document.people, ...document.dates,
      document.decision.label, document.decision.value, document.decision.reason,
      "OwnMind AI",
    ].join(" ").toLocaleLowerCase()

    return matchesFilter && searchableContent.includes(search)
  })

  return filter === "Recently Updated" ? result.sort((a, b) => b.addedDay - a.addedDay) : result
}
