"use client"

import { useRef, useState, type DragEvent } from "react"
import { Check, CircleCheck, FileText, Plus, ShieldCheck, Upload, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

const acceptedExtension = /\.(pdf|txt|md|markdown|docx)$/i

export function AddDocumentsDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function selectFiles(incoming: File[]) {
    const supported = incoming.filter((file) => acceptedExtension.test(file.name))
    setError(supported.length !== incoming.length ? "Choose PDF, TXT, Markdown, or DOCX files. Unsupported files were skipped." : "")
    // Keep only the first supported file since we upload one at a time for this phase
    setFiles(supported.slice(0, 1))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    selectFiles(Array.from(event.dataTransfer.files))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    setError("")
    
    try {
      await api.uploadDocument(files[0])
      setComplete(true)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during upload.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (nextOpen) { setFiles([]); setComplete(false); setError(""); setDragging(false) }
    }}>
      <DialogTrigger render={<Button size="lg" />}><Plus aria-hidden="true" data-icon="inline-start" />Add Documents</DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader className="gap-2 pr-6">
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary-hover ring-1 ring-inset ring-brand-primary/20"><Upload aria-hidden="true" className="size-5" /></div>
          <DialogTitle>Add Project Knowledge</DialogTitle>
          <DialogDescription>Turn project files into facts, entities, and connected decisions.</DialogDescription>
        </DialogHeader>

        {complete ? (
          <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary-hover"><CircleCheck aria-hidden="true" className="size-6" /></div>
            <h3 className="text-base font-medium">Document uploaded successfully.</h3>
            <p className="max-w-sm text-sm leading-relaxed text-text-muted">The file is stored locally on this device.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {["PDF", "TXT", "Markdown", "DOCX"].map((type) => <Badge key={type} variant="outline">{type}</Badge>)}
              <span className="ml-auto text-[10px] text-text-muted">Stored locally</span>
            </div>
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
              onDrop={handleDrop}
              className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center transition-colors", dragging ? "border-accent-cyan bg-brand-primary/10" : "border-border bg-background/30")}
            >
              <Upload aria-hidden="true" className="mb-1 size-7 text-text-muted" />
              <p className="text-sm font-medium">Drop project file here</p>
              <div className="flex items-center gap-2 text-xs text-text-muted">or <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>Browse Files</Button></div>
              <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.markdown,.docx" className="sr-only" tabIndex={-1} aria-label="Choose project files for upload" onChange={(event) => {
                selectFiles(Array.from(event.target.files ?? []))
                event.target.value = ""
              }} />
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {files.length > 0 && (
              <ul aria-label="Selected file" className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText aria-hidden="true" className="size-4 shrink-0 text-brand-primary-hover" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{file.name}</p><p className="mt-1 text-[10px] text-text-muted">{Math.max(1, Math.round(file.size / 1024))} KB · Selected</p></div>
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((candidate) => candidate !== file))}><X aria-hidden="true" /></Button>
                  </li>
                ))}
              </ul>
            )}
            <Alert role="note" className="p-3">
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>Files are processed locally.</AlertTitle>
              <AlertDescription>Your project data stays on this device.</AlertDescription>
            </Alert>
          </>
        )}

        <DialogFooter>
          {complete ? (
            <DialogClose render={<Button />}><Check aria-hidden="true" data-icon="inline-start" />Done</DialogClose>
          ) : (
            <><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button disabled={files.length === 0 || uploading} onClick={handleUpload}>{uploading ? "Uploading..." : "Add to Knowledge Base"}{!uploading && <ArrowIcon />}</Button></>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ArrowIcon() {
  return <Plus aria-hidden="true" data-icon="inline-end" />
}
