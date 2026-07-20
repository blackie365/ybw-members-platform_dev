"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Search, ExternalLink, Trash2, Edit2, Loader2, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  buildPremiumReaderFromLatestIssueAction,
  deleteMagazineIssueAction,
  getLatestPremiumReaderCurationSummaryAction,
  getLatestPremiumReaderStatusAction,
  getMagazineIssuesAction,
} from "@/app/actions/adminActions";
 import Link from"next/link";
import { toast } from "sonner";
 import Image from"next/image";
import { useRouter, useSearchParams } from "next/navigation";

interface PremiumReaderStatus {
  legacyIssueId: string;
  legacyIssueTitle: string;
  state: "legacy_only" | "v2_assembling" | "v2_ready" | "v2_live";
  detail: string;
  editionId?: string;
  editionTitle?: string;
  previewHref?: string | null;
}

interface PremiumReaderCurationSummary {
  legacyIssueId: string;
  legacyIssueTitle: string;
  hasFlipbook: boolean;
  flipbookHref?: string | null;
  presetLabel: string;
  flatplanPageCount: number;
  mappedStoryCount: number;
  availablePageTypes: string[];
  flatplan: Array<{
    position: number;
    intent: string;
    template: string;
  }>;
}

export default function AdminMagazinePage() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [premiumReaderStatus, setPremiumReaderStatus] = useState<PremiumReaderStatus | null>(null)
  const [premiumReaderCurationSummary, setPremiumReaderCurationSummary] = useState<PremiumReaderCurationSummary | null>(null)
  const [loadingPremiumReaderStatus, setLoadingPremiumReaderStatus] = useState(true)
  const [loadingPremiumReaderCurationSummary, setLoadingPremiumReaderCurationSummary] = useState(true)
  const [buildingPremiumReader, setBuildingPremiumReader] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const deleteParam = searchParams.get("delete")
  const deleteHandledRef = useRef(false)

  const loadPremiumReaderStatus = async () => {
    setLoadingPremiumReaderStatus(true)
    const result = await getLatestPremiumReaderStatusAction()
    if (result.success) {
      setPremiumReaderStatus(result.data ?? null)
    }
    setLoadingPremiumReaderStatus(false)
  }

  const loadPremiumReaderCurationSummary = async () => {
    setLoadingPremiumReaderCurationSummary(true)
    const result = await getLatestPremiumReaderCurationSummaryAction()
    if (result.success) {
      setPremiumReaderCurationSummary(result.data ?? null)
    }
    setLoadingPremiumReaderCurationSummary(false)
  }

  const loadIssues = async () => {
    setLoading(true)
    const result = await getMagazineIssuesAction()
    if (result.success && result.data) {
      setIssues(result.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadIssues()
    loadPremiumReaderStatus()
    loadPremiumReaderCurationSummary()
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this issue? This cannot be undone.")) {
      const res = await deleteMagazineIssueAction(id)
      if (res.success) {
        toast.success("Issue deleted successfully")
        loadIssues()
      } else {
        toast.error("Failed to delete issue")
      }
    }
  }

  const handleBuildPremiumReader = async () => {
    setBuildingPremiumReader(true)
    const result = await buildPremiumReaderFromLatestIssueAction()

    if (result.success && result.data) {
      toast.success(
        result.data.unresolvedSlots > 0
          ? `Premium reader refreshed with ${result.data.unresolvedSlots} slots still needing manual polish`
          : "Premium reader refreshed successfully",
      )
      setPremiumReaderStatus({
        legacyIssueId: result.data.legacyIssueId,
        legacyIssueTitle: result.data.legacyIssueTitle,
        state: "v2_assembling",
        detail:
          result.data.unresolvedSlots > 0
            ? "The premium reader preview is built and ready to review, with a few slots still awaiting manual refinement."
            : "The premium reader preview is built and ready to review.",
        editionId: result.data.editionId,
        editionTitle: result.data.editionTitle,
        previewHref: result.data.previewHref,
      })
      await loadIssues()
      await loadPremiumReaderCurationSummary()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to build premium reader")
    }

    setBuildingPremiumReader(false)
  }

  useEffect(() => {
    if (!deleteParam) {
      deleteHandledRef.current = false
      return
    }
    if (deleteHandledRef.current) return
    if (loading) return

    deleteHandledRef.current = true

    if (!issues.some((issue) => issue.id === deleteParam)) {
      router.replace("/admin/magazine")
      return
    }

    Promise.resolve()
      .then(() => handleDelete(deleteParam))
      .finally(() => {
        router.replace("/admin/magazine")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteParam, loading, issues])

  const liveIssue = issues.find(i => i.isLatest);
  const archiveIssues = issues.filter(i => !i.isLatest && i.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Editorial Studio</h1>
          <p className="text-muted-foreground mt-1">Manage your digital publication pipeline.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-white gap-2 h-12 px-6" asChild>
          <Link href="/admin/magazine/builder/new">
            <Plus className="h-5 w-5" />
            Create New Edition
          </Link>
        </Button>
      </div>

      {/* 1. Live Issue Highlight */}
      {liveIssue && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Current Live Edition</h2>
          </div>
          <Card className="border-accent/30 bg-accent/5 overflow-hidden group">
            <div className="flex flex-col md:flex-row items-center gap-8 p-6 md:p-8">
              <div className="relative h-48 w-36 aspect-[3/4] rounded-lg overflow-hidden border shadow-xl shrink-0">
                <Image 
                  src={liveIssue.coverImage} 
                  alt={liveIssue.title} 
                  fill 
                  className="object-cover" 
                />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-3xl font-serif font-bold">{liveIssue.title}</h3>
                  <p className="text-muted-foreground mt-2 max-w-2xl">{liveIssue.description}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                   <div className="flex items-center gap-2 text-zinc-500 font-mono">
                     <Calendar className="h-4 w-4" />
                     Published: {new Date(liveIssue.publishDate).toLocaleDateString()}
                   </div>
                   <Badge variant="secondary" className="bg-white/50">{liveIssue.tags?.length || 0} Spreads Built</Badge>
                </div>
                <div className="rounded-xl border border-accent/20 bg-white/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Premium Reader</p>
                      <p className="mt-2 text-sm text-zinc-700">
                        {loadingPremiumReaderStatus
                          ? "Checking premium reader status..."
                          : premiumReaderStatus?.detail || "Build the premium reader from the current live issue to review the new digital experience in V1."}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-white">
                      {loadingPremiumReaderStatus
                        ? "Loading"
                        : premiumReaderStatus?.state === "legacy_only"
                          ? "Not Built"
                          : premiumReaderStatus?.state === "v2_assembling"
                            ? "In Review"
                            : premiumReaderStatus?.state === "v2_live"
                              ? "Live"
                              : "Preview Ready"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      className="bg-accent text-white hover:bg-accent/90"
                      disabled={buildingPremiumReader}
                      onClick={() => void handleBuildPremiumReader()}
                    >
                      {buildingPremiumReader ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {premiumReaderStatus?.previewHref ? "Refresh Premium Reader" : "Build Premium Reader"}
                    </Button>
                    {premiumReaderStatus?.previewHref ? (
                      <Button variant="outline" asChild>
                        <a href={premiumReaderStatus.previewHref} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Premium Reader
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Flatplan Source</p>
                    <p className="mt-2 text-sm text-zinc-700">
                      Uses the flipbook as the layout guide and the recovered issue content as the slot-fill source.
                    </p>
                    {loadingPremiumReaderCurationSummary ? (
                      <p className="mt-3 text-xs text-zinc-500">Loading flatplan summary...</p>
                    ) : premiumReaderCurationSummary ? (
                      <div className="mt-3 space-y-3 text-xs text-zinc-700">
                        <div className="grid gap-1 font-mono sm:grid-cols-2">
                          <p>Source: {premiumReaderCurationSummary.hasFlipbook ? "flipbook-led" : "local pages only"}</p>
                          <p>Preset: {premiumReaderCurationSummary.presetLabel}</p>
                          <p>Flatplan pages: {premiumReaderCurationSummary.flatplanPageCount}</p>
                          <p>Mapped stories: {premiumReaderCurationSummary.mappedStoryCount}</p>
                        </div>
                        <p className="font-mono">
                          Page types: {premiumReaderCurationSummary.availablePageTypes.length > 0 ? premiumReaderCurationSummary.availablePageTypes.join(", ") : "none found"}
                        </p>
                        <div className="rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[11px] leading-5">
                          {premiumReaderCurationSummary.flatplan.map((page) => (
                            <p key={`${page.position}-${page.intent}`}>
                              {String(page.position).padStart(2, "0")} {page.intent} - {page.template}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">No curation summary is available for the current live issue.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button className="bg-black text-white hover:bg-zinc-800" asChild>
                    <Link href={`/admin/magazine/builder/${liveIssue.id}`}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Content
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`/magazine/issue/${liveIssue.id}`} target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Preview Reader
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/magazine/issue/demo" target="_blank">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Design Preview
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* 2. Archive Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-serif font-bold">Edition Archive</h2>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search historical issues..." 
              className="pl-9 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" /></div>
        ) : archiveIssues.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl">No historical editions found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archiveIssues.map((issue) => (
              <Card key={issue.id} className="hover:border-accent/30 transition-all group overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="relative h-24 w-18 aspect-[3/4] rounded bg-muted overflow-hidden border shrink-0">
                    <Image 
                      src={issue.coverImage} 
                      alt={issue.title} 
                      fill 
                      className="object-cover grayscale group-hover:grayscale-0 transition-all" 
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold truncate text-sm">{issue.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{new Date(issue.publishDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-accent" asChild>
                        <Link href={`/admin/magazine/builder/${issue.id}`}><Edit2 className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-accent" asChild>
                        <a href={`/magazine/issue/${issue.id}`} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive ml-auto" onClick={() => handleDelete(issue.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
