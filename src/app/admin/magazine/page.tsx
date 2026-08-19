"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit2,
  Loader2,
  Calendar,
  FileText,
  BookOpen,
  Link2,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteMagazineIssueAction,
  getEditionsListingAction,
  deleteReaderEditionAction,
  setLatestMagazineIssueAction,
  setFeaturedFlipbookIssueAction,
} from "@/app/actions/magazineActions";
import type { UnifiedEditionRow } from "@/app/actions/magazineActions";

function SourceBadge({ source }: { source: UnifiedEditionRow["source"] }) {
  if (source === "magazine_issue") {
    return (
      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
        <BookOpen className="h-3 w-3 mr-1" />
        CMS Issue
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
      <FileText className="h-3 w-3 mr-1" />
      IDML Reader
    </Badge>
  );
}

export default function AdminMagazinePage() {
  const [editions, setEditions] = useState<UnifiedEditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | UnifiedEditionRow["source"]>("all");
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteParam = searchParams.get("delete");
  const deleteHandledRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const res = await getEditionsListingAction();
    if (res.success && res.data) setEditions(res.data);
    else toast.error(res.error || "Failed to load editions");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (item: UnifiedEditionRow) => {
    const message =
      item.source === "reader_edition"
        ? `Delete reader edition "${item.title}" (source: IDML publish)? This cannot be undone.`
        : `Delete CMS issue "${item.title}"? This cannot be undone.`;
    if (!confirm(message)) return;
    if (item.source === "reader_edition") {
      const res = await deleteReaderEditionAction(item.id);
      if (res.success) {
        toast.success("Reader edition deleted");
        load();
      } else {
        toast.error(res.error || "Delete failed");
      }
    } else {
      const res = await deleteMagazineIssueAction(item.id);
      if (res.success) {
        toast.success("Issue deleted");
        load();
      } else {
        toast.error(res.error || "Delete failed");
      }
    }
  };

  const handleSetLatest = async (item: UnifiedEditionRow) => {
    if (item.source !== "magazine_issue") {
      toast.info("Promote first: link this IDML Reader edition to a CMS Issue in the builder.");
      return;
    }
    const res = await setLatestMagazineIssueAction(item.id);
    if (res.success) {
      toast.success("Set as live edition");
      load();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  const handleSetFeaturedFlipbook = async (item: UnifiedEditionRow) => {
    if (item.source !== "magazine_issue") {
      toast.info("First link the IDML edition to a CMS Issue in the builder.");
      return;
    }
    const res = await setFeaturedFlipbookIssueAction(item.id);
    if (res.success) {
      toast.success("Set as featured flipbook");
      load();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  useEffect(() => {
    if (!deleteParam) {
      deleteHandledRef.current = false;
      return;
    }
    if (deleteHandledRef.current) return;
    if (loading) return;
    deleteHandledRef.current = true;
    const target = editions.find((e) => e.id === deleteParam);
    if (!target) {
      router.replace("/admin/magazine");
      return;
    }
    Promise.resolve()
      .then(() => handleDelete(target))
      .finally(() => router.replace("/admin/magazine"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteParam, loading, editions]);

  const liveIssue = useMemo(
    () => editions.find((e) => e.source === "magazine_issue" && e.isLatest),
    [editions],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return editions.filter((e) => {
      if (filterSource !== "all" && e.source !== filterSource) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        (e.slug || "").toLowerCase().includes(q) ||
        (e.id || "").toLowerCase().includes(q)
      );
    });
  }, [editions, searchQuery, filterSource]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-8 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold">Editorial Studio</h1>
            <p className="text-muted-foreground mt-1">
              Manage every digital edition in one place — CMS spread issues and IDML-published readers.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} className="gap-2 h-12">
              <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-white gap-2 h-12 px-6" asChild>
              <Link href="/admin/magazine/builder/new">
                <Plus className="h-5 w-5" />
                Create New Edition
              </Link>
            </Button>
          </div>
        </div>

        {liveIssue && (
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
                Current Live Edition
              </h2>
            </div>
            <Card className="border-accent/30 bg-accent/5 overflow-hidden group">
              <div className="flex flex-col md:flex-row items-center gap-8 p-6 md:p-8">
                <div className="relative h-48 w-36 aspect-[3/4] rounded-lg overflow-hidden border shadow-xl shrink-0 bg-muted">
                  {liveIssue.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={liveIssue.coverImage}
                      alt={liveIssue.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground italic text-xs">
                      no cover
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source={liveIssue.source} />
                    {liveIssue.isFeaturedFlipbook && (
                      <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Featured Flipbook
                      </Badge>
                    )}
                    {liveIssue.linkedReaderEditionId && (
                      <Badge variant="outline" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        Linked to Reader
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="text-3xl font-serif font-bold">{liveIssue.title}</h3>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                      {liveIssue.description || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-zinc-500 font-mono">
                      <Calendar className="h-4 w-4" />
                      Published:{" "}
                      {new Date(liveIssue.publishDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    {liveIssue.pageCount != null && (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <FileText className="h-4 w-4" />
                        {liveIssue.pageCount} pages
                      </div>
                    )}
                    {liveIssue.spreadCount != null && (
                      <Badge variant="secondary" className="bg-white/50">
                        {liveIssue.spreadCount} Spreads
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {liveIssue.builderPath && (
                      <Button className="bg-black text-white hover:bg-zinc-800" asChild>
                        <Link href={liveIssue.builderPath}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Content
                        </Link>
                      </Button>
                    )}
                    {liveIssue.viewerPath && (
                      <Button variant="outline" asChild>
                        <a href={liveIssue.viewerPath} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Preview Reader
                        </a>
                      </Button>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 ml-auto hover:text-amber-600"
                          onClick={() => handleSetFeaturedFlipbook(liveIssue)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Featured flipbook on homepage</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 hover:text-destructive"
                          onClick={() => handleDelete(liveIssue)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete (cannot undo)</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-xl font-serif font-bold">All Editions</h2>
              <p className="text-xs text-muted-foreground mt-1">
                CMS Issues are spread-builder drafts/issues. IDML Readers are published editions from
                an IDML upload.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border bg-background p-1 h-10">
                {(["all", "magazine_issue", "reader_edition"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterSource(v)}
                    className={`px-3 h-8 rounded text-xs font-medium transition-colors ${
                      filterSource === v
                        ? "bg-accent text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v === "all" ? "All" : v === "magazine_issue" ? "CMS" : "IDML"}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, slug, id…"
                  className="pl-9 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl">
              No editions match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((e) => {
                const isLive = e.source === "magazine_issue" && e.isLatest;
                return (
                  <Card
                    key={e.key}
                    className="hover:border-accent/30 transition-all group overflow-hidden"
                  >
                    <div className="flex gap-4 p-4">
                      <div className="relative h-28 w-20 aspect-[3/4] rounded bg-muted overflow-hidden border shrink-0">
                        {e.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.coverImage}
                            alt={e.title}
                            className={`h-full w-full object-cover ${
                              isLive ? "" : "grayscale group-hover:grayscale-0 transition-all"
                            }`}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground italic text-[10px] px-2 text-center">
                            no cover
                          </div>
                        )}
                        {isLive && (
                          <div className="absolute top-1 left-1 h-2 w-2 rounded-full bg-accent animate-pulse shadow" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            <SourceBadge source={e.source} />
                            {isLive && (
                              <Badge variant="secondary" className="bg-accent/10 text-accent">
                                Live
                              </Badge>
                            )}
                            {e.isFeaturedFlipbook && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Flipbook
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-bold truncate text-sm leading-tight">{e.title}</h4>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(e.publishDate).toLocaleDateString("en-GB", {
                              month: "short",
                              year: "numeric",
                            })}
                            {(e.pageCount ?? e.spreadCount) != null && (
                              <span className="ml-1">
                                • {e.pageCount != null ? `${e.pageCount} p` : ""}
                                {e.pageCount != null && e.spreadCount != null ? " / " : ""}
                                {e.spreadCount != null ? `${e.spreadCount} sp` : ""}
                              </span>
                            )}
                          </div>
                          {e.linkedReaderEditionId ? (
                            <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              Linked to reader
                            </div>
                          ) : e.source === "magazine_issue" ? (
                            <div className="text-[10px] text-amber-600 flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              Not yet published as reader
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              IDML-published reader
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {e.builderPath && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-accent"
                                  asChild
                                >
                                  <Link href={e.builderPath}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open builder</TooltipContent>
                            </Tooltip>
                          )}
                          {e.viewerPath && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-accent"
                                  asChild
                                >
                                  <a href={e.viewerPath} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preview reader</TooltipContent>
                            </Tooltip>
                          )}
                          {e.source === "magazine_issue" && !isLive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 hover:text-emerald-600"
                                  onClick={() => handleSetLatest(e)}
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Promote to live edition</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:text-destructive ml-auto"
                                onClick={() => handleDelete(e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Delete {e.source === "reader_edition" ? "reader edition" : "issue"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}
