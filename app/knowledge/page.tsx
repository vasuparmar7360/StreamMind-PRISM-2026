import type { Metadata } from "next"
import { KnowledgeBase } from "@/components/knowledge/knowledge-base"

export const metadata: Metadata = {
  title: "Knowledge Base — StreamMind AI",
  description: "Explore source-backed project facts, entities, decisions, and their relationships in the StreamMind AI knowledge demo.",
}

export default function KnowledgePage() {
  return <KnowledgeBase />
}
