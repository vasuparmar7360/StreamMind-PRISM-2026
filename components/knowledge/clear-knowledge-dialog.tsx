"use client"

import { useState } from "react"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

export function ClearKnowledgeDialog({ documents, onSuccess }: { documents: any[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [dependenciesWarning, setDependenciesWarning] = useState<any[] | null>(null)

  const handleClear = async (force: boolean = false) => {
    try {
      setIsDeleting(true)
      setError(null)
      
      const failedDeps: any[] = []
      
      for (const doc of documents) {
        try {
          const res = await api.deleteDocument(doc.id, force)
          if (res?.status === "requires_confirmation" && !force) {
            failedDeps.push({ doc, dependencies: res.dependencies })
          }
        } catch (e: any) {
          if (e.status === 404) continue; // Already deleted or doesn't exist
          throw new Error(`Failed on ${doc.original_name}: ${e.message}`)
        }
      }
      
      if (failedDeps.length > 0 && !force) {
        setDependenciesWarning(failedDeps)
        setIsDeleting(false)
        return
      }
      
      // Success
      setOpen(false)
      setConfirmText("")
      setDependenciesWarning(null)
      onSuccess()
    } catch (err: any) {
      setError(err.message || "An error occurred while clearing knowledge.")
    } finally {
      setIsDeleting(false)
    }
  }

  const resetState = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setConfirmText("")
      setError(null)
      setDependenciesWarning(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetState}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:text-danger" />}>
        <Trash2 className="mr-2 size-4" />
        Clear Knowledge
      </DialogTrigger>
      
      <DialogContent>
        {dependenciesWarning ? (
          <>
            <DialogHeader>
              <DialogTitle>Documents have dependencies</DialogTitle>
              <DialogDescription>
                Some documents support active decisions, pending actions, or conflicts. Removing them may affect project memory.
                
                <div className="mt-3 max-h-32 overflow-y-auto space-y-2 border border-border/50 rounded-lg p-2 bg-surface/30">
                  {dependenciesWarning.map((item, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-semibold text-text-primary">{item.doc.original_name}:</span>{" "}
                      {item.dependencies.decisions > 0 && <span>{item.dependencies.decisions} decision(s) </span>}
                      {item.dependencies.actions > 0 && <span>{item.dependencies.actions} action(s) </span>}
                      {item.dependencies.conflicts > 0 && <span>{item.dependencies.conflicts} conflict(s)</span>}
                    </div>
                  ))}
                </div>
              </DialogDescription>
            </DialogHeader>
            
            {error && (
              <div className="text-xs font-medium text-danger bg-danger/10 p-3 rounded-lg">
                {error}
              </div>
            )}
            
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setDependenciesWarning(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleClear(true)} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Remove Anyway
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-5" />
                Clear project knowledge?
              </DialogTitle>
              <DialogDescription>
                This will remove all uploaded knowledge sources from the active project knowledge base.
                <br /><br />
                Type <strong className="font-mono bg-muted px-1 py-0.5 rounded">CLEAR</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>
            
            <div className="my-4">
              <Input 
                value={confirmText} 
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Type CLEAR"
                className="font-mono uppercase"
              />
            </div>
            
            {error && (
              <div className="text-xs font-medium text-danger bg-danger/10 p-3 rounded-lg">
                {error}
              </div>
            )}
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => resetState(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleClear(false)} 
                disabled={confirmText !== "CLEAR" || isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Clear All Knowledge
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
