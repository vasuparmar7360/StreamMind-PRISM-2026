"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, Cpu, CloudOff, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { navItems } from "@/lib/navigation"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { api } from "@/lib/api"

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [systemStatus, setSystemStatus] = useState<any>(null)
  
  // Note: we can't let privateMode toggle actually change backend settings immediately without an endpoint,
  // but if the backend provides local_only we should initialize it.
  const [privateMode, setPrivateMode] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.getSystemStatus()
        setSystemStatus(res)
        if (res.privacy && typeof res.privacy.local_only === 'boolean') {
          setPrivateMode(res.privacy.local_only)
        }
      } catch (e) {
        console.error("Failed to fetch system status", e)
      }
    }
    fetchStatus()
  }, [])

  const isOnline = systemStatus?.ollama?.status === "online"
  const chatModelName = systemStatus?.chat_model?.name || "Unknown Model"
  const isDbOnline = systemStatus?.database?.status === "online"
  const embModelName = systemStatus?.embedding_model?.name || "Unknown Embedding"
  
  return (
    <aside className="workspace-sidebar flex h-full shrink-0 flex-col">
      {/* Brand plate */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="brand-emblem relative">
          <svg viewBox="0 0 24 24" className="size-5 text-brand-primary" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18M3 12h18" opacity=".45" />
            <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
          </svg>
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-success" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-xl text-sidebar-foreground">StreamMind</p>
          <p className="text-[10px] tracking-[.2em] text-muted-foreground uppercase">Sovereign ledger</p>
        </div>
      </div>

      <div className="mx-5 flex items-center justify-between">
        <span className="eyebrow">Index</span>
        <span className="index-label">vol. i</span>
      </div>

      {/* Table-of-contents navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 pt-3">
        <ol className="flex flex-col">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const number = String(index + 1).padStart(2, "0")
            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.href}
                        onClick={() => onNavigate?.()}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex w-full items-center gap-3 px-2 py-2 text-[13px] transition-colors",
                          isActive ? "text-brand-primary" : "text-text-secondary hover:text-text-primary",
                        )}
                      />
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "index-label w-6 shrink-0 tabular-nums transition-colors",
                        isActive ? "text-brand-primary" : "group-hover:text-text-primary",
                      )}
                    >
                      {number}
                    </span>
                    <span className="leader flex-1">
                      <span className={cn("truncate font-medium", isActive && "font-display text-[15px]")}>
                        {item.label}
                      </span>
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-3.5 shrink-0 transition-all duration-300",
                          isActive ? "text-brand-primary" : "text-muted-foreground opacity-60 group-hover:opacity-100",
                        )}
                      />
                    </span>
                    {isActive && (
                      <ArrowRight aria-hidden="true" className="absolute -left-1.5 size-3 text-brand-primary" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.description}</TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ol>

        <div className="mt-5 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
          <span>Jump anywhere</span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </nav>

      {/* Local AI module: instrument panel */}
      <div className="local-module m-4 p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Local AI</p>
          {isOnline ? (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/50" />
              <span className="relative inline-flex size-2 rounded-full bg-success animate-breathe" />
            </span>
          ) : (
             <span className="relative flex size-2">
              <span className="relative inline-flex size-2 rounded-full bg-danger" />
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {/* Generation Model */}
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <Cpu aria-hidden="true" className="size-4 text-brand-primary" />
            ) : (
              <CloudOff aria-hidden="true" className="size-4 text-danger" />
            )}
            <div className="leading-tight">
              <p className={cn("text-xs font-semibold", isOnline ? "text-sidebar-foreground" : "text-danger")}>
                {isOnline ? chatModelName : "Generation Unavailable"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isOnline ? "Running locally" : "Offline"}
              </p>
            </div>
          </div>
          
          {/* Embedding Model */}
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <Cpu aria-hidden="true" className="size-4 text-brand-secondary" />
            ) : (
              <CloudOff aria-hidden="true" className="size-4 text-danger" />
            )}
            <div className="leading-tight">
              <p className={cn("text-xs font-semibold", isOnline ? "text-sidebar-foreground" : "text-danger")}>
                {isOnline ? embModelName : "Embedding Unavailable"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isOnline ? "Vector embedding active" : "Offline"}
              </p>
            </div>
          </div>

          {/* Database */}
          <div className="flex items-center gap-2.5">
            {isDbOnline ? (
              <Database aria-hidden="true" className="size-4 text-success" />
            ) : (
              <CloudOff aria-hidden="true" className="size-4 text-danger" />
            )}
            <div className="leading-tight">
              <p className={cn("text-xs font-semibold", isDbOnline ? "text-sidebar-foreground" : "text-danger")}>
                {isDbOnline ? "PostgreSQL / pgvector" : "Database Offline"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isDbOnline ? "Storage connected" : "Connection failed"}
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col leading-tight">
            <span className="text-xs font-medium text-sidebar-foreground">Private mode</span>
            <span className="text-[10px] text-muted-foreground">{privateMode ? "No data leaves this device" : "Cloud fallback allowed"}</span>
          </span>
          <Switch size="sm" checked={privateMode} disabled={true} aria-label="Private mode" />
        </label>
      </div>
    </aside>
  )
}
