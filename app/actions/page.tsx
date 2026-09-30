import type { Metadata } from "next"
import { ActionsPage } from "@/components/actions-page"

export const metadata: Metadata = {
  title: "Action Center — StreamMind AI",
  description:
    "Review, approve and control every action before StreamMind executes it. Human-in-the-loop sovereign execution.",
}

export default function ActionsRoute() {
  return <ActionsPage />
}
