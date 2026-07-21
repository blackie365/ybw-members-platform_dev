"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Search, ExternalLink, Trash2, Edit2, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteMagazineIssueAction,
  getMagazineIssuesAction,
} from "@/app/actions/adminActions";

export default function AdminMagazinePage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteParam = searchParams.get("delete");
  const deleteHandledRef = useRef(false);

  const loadIssues = async () => {
    setLoading(true);
    const result = await getMagazineIssuesAction();
    if (result.success && result.data) {
      setIssues(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this issue? This cannot be undone.")) {
      const res = await deleteMagazineIssueAction(id);
      if (res.success) {
        toast.success("Issue deleted successfully");
        loadIssues();
      } else {
        toast.error("Failed to delete issue");
      }
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
    if (!issues.some((issue) => issue.id === deleteParam)) {
      router.replace("/admin/magazine");
      return;
    }
    Promise.resolve()
      .then(() => handleDelete(deleteParam))
      .finally(() => {
        router.replace("/admin/magazine");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteParam, loading, issues]);

  const liveIssue = issues.find((i) => i.isLatest);
  const archiveIssues = issues.filter(
    (i) => !i.isLatest && i.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* Live Issue */}
      {liveIssue && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Current Live Edition</h2>
          </div>
          <Card className="border-accent/30 bg-accent/5 overflow-hidden group">
            <div className="flex flex-col md:flex-row items-center gap-8 p-6 md:p-8">
              <div className="relative h-48 w-36 aspect-[3/4] rounded-lg overflow-hidden border shadow-xl shrink-0">
                <Image src={liveIssue.coverImage} alt={liveIssue.title} fill className="object-cover" />
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
                  <Badge variant="secondary" className="bg-white/50">
                    {liveIssue.tags?.length || 0} Spreads
                  </Badge>
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
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Archive */}
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
          <div className="py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
          </div>
        ) : archiveIssues.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl">
            No historical editions found.
          </div>
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
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                        {new Date(issue.publishDate).toLocaleDateString("en-GB", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-accent" asChild>
                        <Link href={`/admin/magazine/builder/${issue.id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-accent" asChild>
                        <a href={`/magazine/issue/${issue.id}`} target="_blank">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive ml-auto"
                        onClick={() => handleDelete(issue.id)}
                      >
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
  );
}
