import type { Metadata } from "next"
import { DecisionsPage } from "@/components/decisions-page"

export const metadata: Metadata = {
  title: "Decision Timeline — StreamMind AI",
  description:
    "Track how project decisions evolve over time, what changed, why it changed, and which source document is authoritative.",
}

export default function DecisionsRoute() {
  return <DecisionsPage />
}
