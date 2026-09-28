import type { Metadata } from "next"
import { SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = {
  title: "Settings — Sovereign Control Center",
  description:
    "Control your model, memory, tools and privacy from one place. Sovereign user-owned AI.",
}

export default function SettingsRoute() {
  return <SettingsPage />
}
