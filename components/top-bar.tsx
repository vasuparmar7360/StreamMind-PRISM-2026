"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ShieldCheck, Search, Menu, LogOut, UserRound, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import { CommandPalette } from "@/components/command-palette"
import { navItems, findNavItem } from "@/lib/navigation"

export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const current = findNavItem(pathname)
  const index = String(navItems.indexOf(current) + 1).padStart(2, "0")

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  }, [])

  return (
    <header className="workspace-topbar relative flex shrink-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <Button variant="ghost" size="icon" className="mobile-menu" onClick={onOpenNavigation} aria-label="Open navigation">
          <Menu />
        </Button>

        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="index-label tabular-nums">{index}</span>
          <h2 className="font-display truncate text-xl leading-none text-text-primary">{current.label}</h2>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={<div className="local-first-badge hidden shrink-0 items-center gap-2 rounded-sm px-2.5 py-1 sm:flex" />}
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            <span className="text-[10px] font-semibold tracking-[0.18em]">LOCAL-FIRST</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Project data stays on this device</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="topbar-search hidden h-9 items-center gap-2 rounded-sm px-3 text-xs md:flex"
          aria-label="Open workspace index"
          aria-haspopup="dialog"
        >
          <Search aria-hidden="true" className="size-3.5" />
          <span>Jump to…</span>
          <span className="ml-4 flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Button variant="outline" size="icon" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label="Open workspace index">
          <Search />
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Account menu" className="rounded-full outline-offset-2">
                <Avatar className="workspace-avatar size-9 text-[11px] font-semibold">
                  <AvatarFallback className="bg-transparent text-brand-primary">PT</AvatarFallback>
                </Avatar>
              </button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-display text-base leading-none">Project Team</span>
              <span className="text-[11px] font-normal text-muted-foreground">Local workspace · single seat</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <UserRound /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <KeyRound /> Encryption keys
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive">
                <LogOut /> Lock workspace
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}
