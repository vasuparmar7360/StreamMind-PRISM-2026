"use client"

import { useEffect, useRef, useState } from "react"
import { Clock3, Database, Search, SearchX, ShieldCheck, X } from "lucide-react"
import { AddDocumentsDialog } from "@/components/knowledge/add-documents-dialog"
import { ClearKnowledgeDialog } from "@/components/knowledge/clear-knowledge-dialog"
import { DocumentCard } from "@/components/knowledge/document-card"
import { DocumentDetail } from "@/components/knowledge/document-detail"
import { KnowledgePipeline } from "@/components/knowledge/knowledge-pipeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Sheet } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/api"
import { knowledgeFilters, type KnowledgeFilter } from "@/lib/knowledge-data"

export function KnowledgeBase() {
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") === "search") search.current?.focus()
  }, [])
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<KnowledgeFilter>("All Files")
  
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)

  const fetchDocs = async () => {
    try {
      setLoading(true)
      const res = await api.getDocuments()
      setDocs(res.documents || [])
      setError(false)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  // Basic filtering based on search query
  const documents = docs.filter(d => 
    !query || d.original_name.toLowerCase().includes(query.toLowerCase())
  )

  function resetFilters() { setQuery(""); setFilter("All Files") }

  return (
    <div className="page-container animate-page-enter">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <Badge variant="outline"><Database aria-hidden="true" data-icon="inline-start" />Knowledge</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Knowledge Base</h1>
          <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-text-muted">Your project files, transformed into searchable and traceable knowledge.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3 pt-1">
          <div className="flex items-center gap-2">
            {docs.length > 0 && <ClearKnowledgeDialog documents={docs} onSuccess={fetchDocs} />}
            <AddDocumentsDialog onSuccess={fetchDocs} />
          </div>
          <Badge variant="current"><span aria-hidden="true" className="size-1 rounded-full bg-brand-primary" />{docs.length} Documents</Badge>
        </div>
      </header>

      <div className="mt-8"><KnowledgePipeline /></div>

      <section aria-label="Search and filter project knowledge" className="mt-8 flex flex-col gap-4">
        <InputGroup className="h-10">
          <InputGroupInput ref={search} aria-label="Search project knowledge" placeholder="Search project knowledge..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <InputGroupAddon className="pl-3"><Search aria-hidden="true" /></InputGroupAddon>
          {query && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}><X aria-hidden="true" /></InputGroupButton></InputGroupAddon>}
        </InputGroup>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup aria-label="Filter project knowledge" value={[filter]} onValueChange={(values) => { if (values.length) setFilter(values[0] as KnowledgeFilter) }} size="sm" spacing={1} className="max-w-full flex-wrap">
            {knowledgeFilters.map((item) => <ToggleGroupItem key={item} value={item}>{item === "Recently Updated" && <Clock3 aria-hidden="true" data-icon="inline-start" />}{item}</ToggleGroupItem>)}
          </ToggleGroup>
          <span aria-live="polite" role="status" className="text-[11px] text-text-muted">{documents.length} {documents.length === 1 ? "source" : "sources"}</span>
        </div>
      </section>

      <section aria-labelledby="indexed-sources-heading" className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="indexed-sources-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Indexed sources</h2>
          <span className="text-[10px] text-text-muted">Select a source to explore its knowledge</span>
        </div>
        {error ? (
          <Empty className="min-h-64 border border-red-500/20 bg-red-500/5">
            <EmptyHeader>
              <EmptyTitle className="text-red-500">Could not load project documents.</EmptyTitle>
            </EmptyHeader>
            <EmptyContent><Button variant="outline" onClick={fetchDocs}>Retry</Button></EmptyContent>
          </Empty>
        ) : loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-text-muted">Loading documents...</div>
        ) : docs.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader><EmptyMedia variant="icon"><Database aria-hidden="true" /></EmptyMedia><EmptyTitle>No project documents yet.</EmptyTitle><EmptyDescription>Add your first document to build the knowledge base.</EmptyDescription></EmptyHeader>
          </Empty>
        ) : documents.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader><EmptyMedia variant="icon"><SearchX aria-hidden="true" /></EmptyMedia><EmptyTitle>No matching knowledge</EmptyTitle><EmptyDescription>Try another file name, fact, person, or decision, or clear your filters.</EmptyDescription></EmptyHeader>
            <EmptyContent><Button variant="outline" onClick={resetFilters}>Clear search and filters</Button></EmptyContent>
          </Empty>
        ) : (
          <Sheet>
            <div className="grid grid-cols-1 gap-4 min-[800px]:grid-cols-2 min-[1150px]:grid-cols-3">
              {documents.map((document) => <DocumentCard key={document.id} document={document} onSelect={async () => {
                try {
                  const fullDoc = await api.getDocument(document.id)
                  setSelectedDocument(fullDoc)
                } catch (e) {
                  setSelectedDocument(document)
                }
              }} onDeleteSuccess={fetchDocs} />)}
            </div>
            <DocumentDetail document={selectedDocument} onSelectSource={setSelectedDocument} />
          </Sheet>
        )}
      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[10px] text-text-muted">
        <p className="flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" />Source-backed. Traceable. Yours.</p>
        <p>Showing {documents.length} of {docs.length} source{docs.length === 1 ? "" : "s"}</p>
      </footer>
    </div>
  )
}
