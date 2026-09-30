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
  { label: "Knowledge", description: "Indexed documents, facts and entities", icon: Database, href: "/knowledge" },
  { label: "Ask StreamMind", description: "Source-backed answers and live replay", icon: Sparkles, href: "/ask" },
]

export function findNavItem(pathname: string) {
  return navItems.find((item) => item.href === pathname) ?? navItems[0]
}
