"use client"

import { useEffect, useState, useRef } from "react"
import { ArrowUpRight, Check, FileCode2, FileText, GitBranch, ListChecks, NotebookPen, MoreHorizontal, Trash2, Loader2, PlayCircle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const categoryStyles = {
  PDF: "bg-brand-primary/10 text-brand-primary-hover ring-accent-blue/20",
  "Meeting Notes": "bg-brand-primary/10 text-brand-primary-hover ring-brand-primary/20",
  Technical: "bg-brand-secondary/10 text-brand-secondary ring-accent-purple/20",
  Research: "bg-brand-primary/10 text-brand-primary-hover ring-accent-blue/20",
  Notes: "bg-brand-secondary/10 text-brand-secondary ring-accent-purple/20",
}

export function DocumentCard({ document: initialDocument, onSelect, onDeleteSuccess }: { document: any; onSelect: () => void; onDeleteSuccess?: () => void }) {
  const [document, setDocument] = useState(initialDocument)
  
  // Sync if parent updates the initial prop
  useEffect(() => {
    setDocument(initialDocument)
  }, [initialDocument])

  const isTechnical = document.extension === ".json" || document.extension === ".csv"
  const isNotes = document.extension === ".txt" || document.extension === ".md"
  const Icon = isTechnical ? FileCode2 : isNotes ? NotebookPen : FileText
  const catStyle = isTechnical ? categoryStyles.Technical : isNotes ? categoryStyles.Notes : categoryStyles.PDF
  const category = isTechnical ? "Technical" : isNotes ? "Notes" : document.extension === ".pdf" ? "PDF" : "Document"
  
  const dateStr = document.created_at ? new Date(document.created_at).toLocaleDateString() : "Unknown date"

  // Polling State
  const [isProcessing, setIsProcessing] = useState(document.status === "indexing")
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (document.status === "indexing") {
      setIsProcessing(true)
      pollingRef.current = setInterval(async () => {
        try {
          const freshDoc = await api.getDocument(document.id)
          setDocument(freshDoc)
          if (freshDoc.status !== "indexing") {
            setIsProcessing(false)
            if (pollingRef.current) clearInterval(pollingRef.current)
            if (onDeleteSuccess) onDeleteSuccess() // trigger parent refresh to update overview counts
          }
        } catch (e) {
          console.error("Polling failed", e)
        }
      }, 3000)
    } else {
      setIsProcessing(false)
    }
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [document.status, document.id, onDeleteSuccess])

  const handleManualProcess = async () => {
    try {
      setIsProcessing(true)
      setDocument(prev => ({ ...prev, status: "indexing" }))
      await api.indexDocument(document.id)
    } catch (e) {
      console.error(e)
      setDocument(prev => ({ ...prev, status: "failed" }))
      setIsProcessing(false)
    }
  }

  // Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDependencyConfirm, setShowDependencyConfirm] = useState(false)
  const [dependencies, setDependencies] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteInitial = async () => {
    setShowDeleteConfirm(true)
    setDeleteError(null)
  }

  const confirmDelete = async (force: boolean = false) => {
    try {
      setIsDeleting(true)
      setDeleteError(null)
      const res = await api.deleteDocument(document.id, force)
      
      if (res.status === "requires_confirmation" && !force) {
        setDependencies(res.dependencies)
        setShowDeleteConfirm(false)
        setShowDependencyConfirm(true)
        setIsDeleting(false)
        return
      }

      // Success
      setShowDeleteConfirm(false)
      setShowDependencyConfirm(false)
      if (onDeleteSuccess) {
        onDeleteSuccess()
      }
    } catch (err: any) {
      setDeleteError(err.message || "Failed to remove document.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <article className="group relative min-w-0 rounded-2xl transition-transform duration-200 motion-safe:hover:-translate-y-0.5" data-document-id={document.id}>
        <Card size="sm" className="h-full rounded-2xl [--card-spacing:--spacing(5)] transition-shadow duration-200 group-hover:ring-brand-primary/20 group-focus-within:ring-brand-primary/20">
          <CardHeader className="gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className={cn("flex size-10 items-center justify-center rounded-xl ring-1 ring-inset", catStyle)}>
                <Icon aria-hidden="true" className="size-5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={document.status === "indexed" ? "current" : (isProcessing ? "current" : "outline")} className={isProcessing ? "animate-pulse bg-brand-primary/20 text-brand-primary ring-brand-primary/30" : ""}>
                  {document.status === "indexed" && <Check aria-hidden="true" data-icon="inline-start" />}
                  {isProcessing && <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin" />}
                  {isProcessing ? "Processing..." : document.status}
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="relative z-10 size-6 text-text-muted hover:text-foreground" />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 z-50">
                    {(document.status === "uploaded" || document.status === "failed") && (
                      <DropdownMenuItem 
                        onClick={handleManualProcess}
                        disabled={isProcessing}
                        className="cursor-pointer"
                      >
                        {isProcessing ? <RefreshCw className="mr-2 size-3.5 animate-spin text-brand-primary" /> : <PlayCircle className="mr-2 size-3.5 text-brand-primary" />}
                        {isProcessing ? "Processing..." : (document.status === "failed" ? "Retry Processing" : "Process Document")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={handleDeleteInitial}
                      className="text-danger focus:text-danger focus:bg-danger/10 cursor-pointer"
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Delete Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <CardTitle>
              <h3>
                <SheetTrigger
                  onClick={onSelect}
                  aria-label={`View knowledge from ${document.original_name}`}
                  className="block w-full cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent-cyan"
                >
                  <span className="block truncate pr-6" title={document.original_name}>{document.original_name}</span>
                </SheetTrigger>
              </h3>
            </CardTitle>
            <div className="-mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <span className="uppercase">{document.extension?.replace('.', '') || "FILE"}</span>
              <span aria-hidden="true" className="size-0.5 rounded-full bg-muted-foreground/60" />
              <span>Added {dateStr}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-xs leading-relaxed text-text-muted">
              {document.status === "indexed" 
                ? "Successfully indexed and available for semantic search." 
                : isProcessing
                  ? "Extracting facts, chunks, and decisions..."
                  : document.status === "failed" 
                    ? "Indexing failed for this document."
                    : "Awaiting indexing. Click the menu to process."}
            </p>
          </CardContent>
          <CardFooter className="gap-4 py-3">
            <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <ListChecks aria-hidden="true" className="size-3.5 text-brand-primary-hover/80" />
              <span className="font-semibold text-text-primary">{document.chunk_count || 0}</span> chunks
            </span>
            <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-text-muted transition-colors group-hover:text-brand-primary-hover" />
          </CardFooter>
        </Card>
      </article>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove "{document.original_name}"?</DialogTitle>
            <DialogDescription>
              This source will be removed from the active knowledge base.
              Any indexed chunks and embeddings associated with it will also be removed.
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="text-xs font-medium text-danger bg-danger/10 p-3 rounded-lg">
              {deleteError}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete(false)} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Remove Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dependency Warning Modal */}
      <Dialog open={showDependencyConfirm} onOpenChange={setShowDependencyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document has dependencies</DialogTitle>
            <DialogDescription>
              This document supports:
              {dependencies?.decisions > 0 && <span className="block mt-1 font-medium text-text-primary">{dependencies.decisions} active decision{dependencies.decisions !== 1 && 's'}</span>}
              {dependencies?.actions > 0 && <span className="block mt-1 font-medium text-text-primary">{dependencies.actions} pending action{dependencies.actions !== 1 && 's'}</span>}
              {dependencies?.conflicts > 0 && <span className="block mt-1 font-medium text-text-primary">{dependencies.conflicts} open conflict{dependencies.conflicts !== 1 && 's'}</span>}
              
              <span className="block mt-3">Removing it may affect project memory.</span>
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="text-xs font-medium text-danger bg-danger/10 p-3 rounded-lg">
              {deleteError}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowDependencyConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete(true)} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Remove Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
