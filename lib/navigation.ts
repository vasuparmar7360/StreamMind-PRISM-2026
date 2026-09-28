import {
  Database,
  GitBranch,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  description: string
  icon: LucideIcon
  href: string
}

/** Single source for the sidebar index, topbar title and command palette. */
export const navItems: NavItem[] = [
  { label: "Overview", description: "Project intelligence at a glance", icon: LayoutDashboard, href: "/" },
  { label: "Knowledge", description: "Indexed documents, facts and entities", icon: Database, href: "/knowledge" },
  { label: "Decisions", description: "Decision lineage and conflicts", icon: GitBranch, href: "/decisions" },
  { label: "Ask OwnMind", description: "Source-backed answers", icon: Sparkles, href: "/ask" },
  { label: "Actions", description: "Pending and completed actions", icon: Zap, href: "/actions" },
  { label: "Audit Log", description: "Every read, write and inference", icon: ScrollText, href: "/audit-log" },
  { label: "Settings", description: "Model, memory and privacy controls", icon: Settings, href: "/settings" },
]

export function findNavItem(pathname: string) {
  return navItems.find((item) => item.href === pathname) ?? navItems[0]
}
