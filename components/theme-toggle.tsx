"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Flips the workspace between pistachio-paper day and bottle-green night. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        }
      >
        <span className="relative grid size-4 place-items-center">
          <Sun className={isDark ? "absolute scale-0 rotate-90 opacity-0 transition-all duration-300" : "absolute transition-all duration-300"} />
          <Moon className={isDark ? "absolute transition-all duration-300" : "absolute scale-0 -rotate-90 opacity-0 transition-all duration-300"} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{isDark ? "Day plate" : "Night plate"}</TooltipContent>
    </Tooltip>
  )
}
