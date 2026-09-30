import type { Metadata } from "next"
import { AskPage } from "@/components/ask-page"

export const metadata: Metadata = {
  title: "Ask StreamMind — Sovereign Second Brain",
  description:
    "Ask across your project knowledge, decisions and memory with traceable, source-backed evidence.",
}

export default function AskRoute() {
  return <AskPage />
}
