export const decisionChanges = [
  {
    id: "demo-date",
    title: "Demo Date",
    previous: "7 October",
    current: "9 October",
    reason: "Sensor delivery delayed",
    source: "Meeting_Update_21Sep.pdf",
    date: "21 Sep",
  },
  {
    id: "backend-framework",
    title: "Backend Framework",
    previous: "Flask",
    current: "FastAPI",
    reason: "Better compatibility with the Python AI pipeline",
    source: "Architecture_Notes.pdf",
    date: "20 Sep",
  },
] as const

export const demoDateDecision = decisionChanges[0]
