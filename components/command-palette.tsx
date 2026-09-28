"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Search, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { navItems } from "@/lib/navigation"

/**
 * One keyboard-first entry point for the whole workspace. Opens on ⌘K / Ctrl+K;
 * the topbar search button and sidebar hint both route here.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  function searchKnowledge() {
    onOpenChange(false)
    if (pathname === "/knowledge") {
      document.querySelector<HTMLInputElement>('[aria-label="Search project knowledge"]')?.focus()
    } else {
      router.push("/knowledge?focus=search")
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Workspace index" description="Jump to a page or run a command." className="sm:max-w-lg">
      <CommandInput placeholder="Jump to a plate, or type a command…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nothing filed under that name.</CommandEmpty>
        <CommandGroup heading="Plates">
          {navItems.map((item, index) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} value={`${item.label} ${item.description}`} onSelect={() => go(item.href)}>
                <Icon />
                <span className="flex-1">{item.label}</span>
                <CommandShortcut className="index-label">{String(index + 1).padStart(2, "0")}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Commands">
          <CommandItem value="search knowledge documents" onSelect={searchKnowledge}>
            <Search />
            <span className="flex-1">Search project knowledge</span>
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light night day"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
              onOpenChange(false)
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            <span className="flex-1">{resolvedTheme === "dark" ? "Switch to day plate" : "Switch to night plate"}</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
