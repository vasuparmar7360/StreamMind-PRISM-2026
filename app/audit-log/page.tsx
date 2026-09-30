import type { Metadata } from "next"
import { AuditPage } from "@/components/audit-page"

export const metadata: Metadata = {
  title: "Audit Trail — StreamMind AI",
  description:
    "Every important memory, decision and AI action remains traceable. Tamper-aware history.",
}

export default function AuditLogRoute() {
  return <AuditPage />
}
