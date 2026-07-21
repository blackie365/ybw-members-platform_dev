"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Search, ExternalLink, Trash2, Edit2, Loader2, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPremiumReaderFromLatestIssueAction,
  deleteMagazineIssueAction,
  getLatestPremiumReaderStatusAction,
  getMagazineIssuesAction,
  saveLatestPremiumReaderStorySelectionAction,
} from "@/app/actions/adminActions";
 import Link from"next/link";
import { toast } from "sonner";
 import Image from"next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { StoryLibraryItem } from "@/components/admin/magazine-builder/types";
import type { StoryContentType } from "@/features/magazine/domain/types";

interface PremiumReaderStatus {
  legacyIssueId: string;
  legacyIssueTitle: string;
  state: "legacy_only" | "v2_assembling" | "v2_ready" | "v2_live";
  detail: string;
  editionId?: string;
  editionTitle?: string;
  previewHref?: string | null;
}

const PREMIUM_READER_TYPE_OPTIONS: Array<{ value: StoryContentType; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "feature", label: "Feature" },
  { value: "profile", label: "Profile" },
  { value: "column", label: "Column" },
  { value: "partner", label: "Partner" },
  { value: "editorial", label: "Editorial" },
  { value: "utility", label: "Utility" },
];

const isIncludedInPremiumReader = (item: StoryLibraryItem) => item.includedInPremiumReader !== false;

function normalizeStoryLibraryItem(item: StoryLibraryItem): StoryLibraryItem {
  const text = String(item.text || "").trim();
  const standfirst = String(item.standfirst || "").trim();
  const priority = Number.isFinite(Number(item.premiumReaderPriority))
    ? Math.max(1, Math.min(100, Math.round(Number(item.premiumReaderPriority))))
    : 40;

  return {
    ...item,
    title: String(item.title || "").trim() || "Untitled Story",
    author: String(item.author || "").trim() || undefined,
    standfirst: standfirst || undefined,
    text,
    includedInPremiumReader: isIncludedInPremiumReader(item),
    premiumReaderPriority: priority,
    premiumReaderContentType: item.premiumReaderContentType || "feature",
    premiumReaderPlacementPreference: "auto",
  };
}

function serializeStoryLibrary(items: StoryLibraryItem[]) {
  return JSON.stringify(
    items.map((item) => ({
      id: item.id,
      includedInPremiumReader: isIncludedInPremiumReader(item),
      premiumReaderPriority: item.premiumReaderPriority ?? 40,
      premiumReaderContentType: item.premiumReaderContentType || "feature",
      premiumReaderPlacementPreference: "auto",
      title: item.title,
      author: item.author || "",
      standfirst: item.standfirst || "",
      text: item.text,
    })),
  );
}

export default function AdminMagazinePage() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [premiumReaderStatus, setPremiumReaderStatus] = useState<PremiumReaderStatus | null>(null)
  const [loadingPremiumReaderStatus, setLoadingPremiumReaderStatus] = useState(true)
  const [buildingPremiumReader, setBuildingPremiumReader] = useState(false)
  const [storySelectionDraft, setStorySelectionDraft] = useState<StoryLibraryItem[]>([])
  const [storySelectionQuery, setStorySelectionQuery] = useState("")
  const [savingStorySelection, setSavingStorySelection] = useState(false)
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
  const liveIssueStoryLibrary = Array.isArray(liveIssue?.storyLibrary)
    ? (liveIssue.storyLibrary as StoryLibraryItem[]).map(normalizeStoryLibraryItem)
    : [];
  const normalizedStorySelectionDraft = storySelectionDraft.map(normalizeStoryLibraryItem);
  const includedStoryCount = normalizedStorySelectionDraft.filter(isIncludedInPremiumReader).length;
  const filteredStorySelectionDraft = normalizedStorySelectionDraft
    .filter((story) => {
      const query = storySelectionQuery.trim().toLowerCase();
      if (!query) return true;
      return [story.title, story.author, story.source?.fileName, story.premiumReaderContentType, story.premiumReaderPlacementPreference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((left, right) => {
      const includedDelta = Number(isIncludedInPremiumReader(right)) - Number(isIncludedInPremiumReader(left));
      if (includedDelta !== 0) return includedDelta;
      const priorityDelta = (right.premiumReaderPriority ?? 40) - (left.premiumReaderPriority ?? 40);
      if (priorityDelta !== 0) return priorityDelta;
      return String(left.title).localeCompare(String(right.title));
    });
  const hasPendingStorySelectionChanges =
    serializeStoryLibrary(liveIssueStoryLibrary) !== serializeStoryLibrary(normalizedStorySelectionDraft);

  useEffect(() => {
    setStorySelectionDraft(liveIssueStoryLibrary);
  }, [liveIssue?.id, serializeStoryLibrary(liveIssueStoryLibrary)])

  const updateStorySelectionItem = (storyId: string, patch: Partial<StoryLibraryItem>) => {
    setStorySelectionDraft((current) =>
      current.map((item) =>
        item.id === storyId
          ? normalizeStoryLibraryItem({
              ...item,
              ...patch,
            })
          : normalizeStoryLibraryItem(item),
      ),
    )
  }

  const handleSaveStorySelection = async () => {
    if (!liveIssue) return

    setSavingStorySelection(true)
    const result = await saveLatestPremiumReaderStorySelectionAction(normalizedStorySelectionDraft)

    if (result.success && result.data) {
      toast.success(`Saved article selection for premium reader: ${result.data.selectedStoryCount} selected`)
      await loadIssues()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to save premium reader article selection")
    }

    setSavingStorySelection(false)
  }

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
                    <Button variant="outline" asChild>
                      <Link href={`/admin/magazine/builder/${liveIssue.id}#story-library`}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Open Story Library
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Selected Articles</p>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-700">
                          Choose exactly which saved stories feed the premium reader and set their editorial importance before you build.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                          {includedStoryCount} selected
                        </Badge>
                        <Button
                          variant="outline"
                          disabled={!hasPendingStorySelectionChanges || savingStorySelection}
                          onClick={() => void handleSaveStorySelection()}
                        >
                          {savingStorySelection ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Save Article Selection
                        </Button>
                      </div>
                    </div>

                    {liveIssueStoryLibrary.length > 0 ? (
                      <>
                        <div className="mt-4 max-w-sm">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Search saved stories</Label>
                          <Input
                            className="mt-2"
                            value={storySelectionQuery}
                            onChange={(event) => setStorySelectionQuery(event.target.value)}
                            placeholder="Search by title, author, file, or type..."
                          />
                        </div>
                        <div className="mt-4 space-y-3">
                          {filteredStorySelectionDraft.map((story) => (
                            <div key={story.id} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-semibold text-zinc-900">{story.title}</p>
                                    <Badge variant="secondary" className={isIncludedInPremiumReader(story) ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}>
                                      {isIncludedInPremiumReader(story) ? "Included" : "Excluded"}
                                    </Badge>
                                    <Badge variant="secondary" className="bg-white text-zinc-700">
                                      {story.premiumReaderContentType || "feature"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {[story.author, story.source?.fileName].filter(Boolean).join(" · ") || "Saved story"}
                                  </p>
                                  {story.standfirst ? (
                                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-700">{story.standfirst}</p>
                                  ) : null}
                                </div>

                                <div className="grid gap-3 md:grid-cols-[auto_110px_150px] xl:min-w-[460px]">
                                  <Button
                                    variant={isIncludedInPremiumReader(story) ? "default" : "outline"}
                                    className={isIncludedInPremiumReader(story) ? "bg-accent text-white hover:bg-accent/90" : ""}
                                    onClick={() =>
                                      updateStorySelectionItem(story.id, {
                                        includedInPremiumReader: !isIncludedInPremiumReader(story),
                                      })
                                    }
                                  >
                                    {isIncludedInPremiumReader(story) ? "Use Article" : "Ignore Article"}
                                  </Button>

                                  <div>
                                    <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Priority</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={story.premiumReaderPriority ?? 40}
                                      onChange={(event) =>
                                        updateStorySelectionItem(story.id, {
                                          premiumReaderPriority: Number(event.target.value || 40),
                                        })
                                      }
                                      className="mt-2"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Story Type</Label>
                                    <Select
                                      value={story.premiumReaderContentType || "feature"}
                                      onValueChange={(value) =>
                                        updateStorySelectionItem(story.id, {
                                          premiumReaderContentType: value as StoryContentType,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="mt-2 bg-white">
                                        <SelectValue placeholder="Select story type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {PREMIUM_READER_TYPE_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm text-zinc-600">
                          No saved stories are available yet. Add stories in the story library first, then choose which ones the premium reader should use.
                        </p>
                      </div>
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
