'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  GripVertical,
  LayoutGrid,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  listFlatPlansAction,
  getFlatPlanAction,
  saveFlatPlanAction,
  deleteFlatPlanAction,
} from '@/app/actions/magazineActions';
import {
  FLAT_PLAN_STATUSES,
  FlatPlan,
  FlatPlanPage,
  FlatPlanStatusKey,
  FlatPlanSummary,
  getFlatPlanStatus,
  makeFlatPlanPage,
} from '@/features/magazine/domain/flat-plan';

type View = 'list' | 'editor';

const DEFAULT_PAGE_COUNT = 24;
const MAX_PAGE_COUNT = 400;

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FlatPlansAdminPage() {
  const [view, setView] = useState<View>('list');
  const [plans, setPlans] = useState<FlatPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<FlatPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // New-plan form
  const [newTitle, setNewTitle] = useState('');
  const [newPublication, setNewPublication] = useState('');
  const [newPageCount, setNewPageCount] = useState(DEFAULT_PAGE_COUNT);

  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const res = await listFlatPlansAction();
    if (res.success && res.data) setPlans(res.data);
    else toast.error(res.error || 'Failed to load flat plans');
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.publication || '').toLowerCase().includes(q),
    );
  }, [plans, search]);

  const selectedPage = useMemo(
    () => current?.pages.find((p) => p.id === selectedPageId) || null,
    [current, selectedPageId],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const page of current?.pages || []) {
      counts[page.status] = (counts[page.status] || 0) + 1;
    }
    return counts;
  }, [current]);

  const openPlan = useCallback(async (id: string) => {
    setLoading(true);
    const res = await getFlatPlanAction(id);
    setLoading(false);
    if (res.success && res.data) {
      setCurrent(res.data);
      setSelectedPageId(res.data.pages[0]?.id ?? null);
      setDirty(false);
      setView('editor');
    } else {
      toast.error(res.error || 'Failed to open flat plan');
    }
  }, []);

  const createPlan = useCallback(async () => {
    const title = newTitle.trim() || 'Untitled flat plan';
    const count = Math.max(1, Math.min(MAX_PAGE_COUNT, Math.floor(newPageCount) || DEFAULT_PAGE_COUNT));
    const pages = Array.from({ length: count }, () => makeFlatPlanPage());
    setSaving(true);
    const res = await saveFlatPlanAction({
      title,
      publication: newPublication.trim() || undefined,
      pages,
    });
    setSaving(false);
    if (res.success && res.data) {
      toast.success('Flat plan created');
      setNewTitle('');
      setNewPublication('');
      setNewPageCount(DEFAULT_PAGE_COUNT);
      setCurrent(res.data);
      setSelectedPageId(res.data.pages[0]?.id ?? null);
      setDirty(false);
      setView('editor');
      void loadPlans();
    } else {
      toast.error(res.error || 'Failed to create flat plan');
    }
  }, [loadPlans, newPageCount, newPublication, newTitle]);

  const persist = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    const res = await saveFlatPlanAction({
      id: current.id,
      title: current.title,
      publication: current.publication,
      pages: current.pages,
    });
    setSaving(false);
    if (res.success && res.data) {
      setCurrent(res.data);
      setDirty(false);
      toast.success('Flat plan saved');
      void loadPlans();
    } else {
      toast.error(res.error || 'Failed to save flat plan');
    }
  }, [current, loadPlans]);

  const deletePlan = useCallback(
    async (plan: FlatPlanSummary) => {
      if (!confirm(`Delete flat plan "${plan.title}"? This cannot be undone.`)) return;
      const res = await deleteFlatPlanAction(plan.id);
      if (res.success) {
        toast.success('Flat plan deleted');
        if (current?.id === plan.id) {
          setCurrent(null);
          setView('list');
          setDirty(false);
        }
        void loadPlans();
      } else {
        toast.error(res.error || 'Failed to delete flat plan');
      }
    },
    [current?.id, loadPlans],
  );

  const backToList = useCallback(() => {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    setView('list');
    setCurrent(null);
    setSelectedPageId(null);
    setDirty(false);
    void loadPlans();
  }, [dirty, loadPlans]);

  const patchPage = useCallback((pageId: string, patch: Partial<FlatPlanPage>) => {
    setCurrent((prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
          }
        : prev,
    );
    setDirty(true);
  }, []);

  const addPage = useCallback(() => {
    const page = makeFlatPlanPage();
    setCurrent((prev) => (prev ? { ...prev, pages: [...prev.pages, page] } : prev));
    setSelectedPageId(page.id);
    setDirty(true);
  }, []);

  const removePage = useCallback((pageId: string) => {
    setCurrent((prev) => (prev ? { ...prev, pages: prev.pages.filter((p) => p.id !== pageId) } : prev));
    setSelectedPageId((prev) => (prev === pageId ? null : prev));
    setDirty(true);
  }, []);

  const movePage = useCallback((from: number, to: number) => {
    setCurrent((prev) => {
      if (!prev) return prev;
      if (from === to || from < 0 || to < 0 || from >= prev.pages.length || to >= prev.pages.length) {
        return prev;
      }
      const pages = [...prev.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      return { ...prev, pages };
    });
    setDirty(true);
  }, []);

  // ---------- List view ----------
  if (view === 'list') {
    return (
      <div className="mx-auto max-w-6xl space-y-10 p-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold">Flat Plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A lightweight page planner — map out pages, order and production status.
            </p>
          </div>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/admin/magazine">
              <BookOpen className="h-4 w-4" />
              Back to Magazine
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  placeholder="e.g. July 2026 issue"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Publication (optional)</label>
                <Input
                  placeholder="e.g. Yorkshire Businesswoman"
                  value={newPublication}
                  onChange={(e) => setNewPublication(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pages</label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_PAGE_COUNT}
                  className="w-24"
                  value={newPageCount}
                  onChange={(e) => setNewPageCount(Number(e.target.value))}
                />
              </div>
              <Button onClick={createPlan} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create plan
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your plans</h2>
            <Input
              placeholder="Search plans…"
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-20 text-center text-muted-foreground">
              <LayoutGrid className="mx-auto mb-3 h-8 w-8 opacity-40" />
              {plans.length === 0 ? 'No flat plans yet — create one above.' : 'No plans match your search.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => (
                <Card key={plan.id} className="group transition-all hover:border-accent/40 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 pt-6">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-serif text-lg font-semibold leading-tight">{plan.title}</h3>
                      {plan.publication && (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {plan.publication}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{plan.pageCount} pages</Badge>
                      <span>Updated {formatDate(plan.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="flex-1" onClick={() => openPlan(plan.id)}>
                        Open
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-destructive"
                        onClick={() => deletePlan(plan)}
                        aria-label={`Delete ${plan.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Editor view ----------
  if (!current) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={backToList} aria-label="Back to plans">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input
          className="h-11 max-w-sm flex-1 font-serif text-lg font-semibold"
          value={current.title}
          onChange={(e) => {
            setCurrent({ ...current, title: e.target.value });
            setDirty(true);
          }}
        />
        <Input
          className="h-11 max-w-xs"
          placeholder="Publication"
          value={current.publication || ''}
          onChange={(e) => {
            setCurrent({ ...current, publication: e.target.value });
            setDirty(true);
          }}
        />
        <Badge variant="secondary">{current.pages.length} pages</Badge>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <Button onClick={persist} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
        {FLAT_PLAN_STATUSES.map((status) => (
          <span key={status.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-3 w-3 rounded-full ${status.swatchClass}`} />
            {status.label}
            {statusCounts[status.key] ? (
              <span className="text-foreground/70">({statusCounts[status.key]})</span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Page grid */}
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {current.pages.map((page, index) => {
              const status = getFlatPlanStatus(page.status);
              const isSelected = page.id === selectedPageId;
              const isOver = overIndex === index;
              return (
                <div
                  key={page.id}
                  draggable
                  onDragStart={() => {
                    dragIndexRef.current = index;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overIndex !== index) setOverIndex(index);
                  }}
                  onDragLeave={() => setOverIndex((prev) => (prev === index ? null : prev))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragIndexRef.current;
                    if (from !== null) movePage(from, index);
                    dragIndexRef.current = null;
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null;
                    setOverIndex(null);
                  }}
                  onClick={() => setSelectedPageId(page.id)}
                  className={[
                    'relative flex aspect-[3/4] cursor-pointer flex-col rounded-lg border p-2 transition-all',
                    status.tileClass,
                    isSelected ? 'ring-2 ring-accent ring-offset-1' : 'hover:shadow-md',
                    isOver ? 'outline outline-2 outline-dashed outline-accent' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tabular-nums opacity-70">{index + 1}</span>
                    <GripVertical className="h-3.5 w-3.5 opacity-30" />
                  </div>
                  <div className="flex flex-1 items-center justify-center px-0.5 text-center">
                    <span className="line-clamp-4 text-xs font-medium leading-tight">
                      {page.label || <span className="opacity-40">Empty</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[10px] opacity-70">{status.label}</span>
                    {page.notes ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" /> : null}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addPage}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px]">Add page</span>
            </button>
          </div>
        </div>

        {/* Page inspector */}
        <div className="lg:w-80 lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            {selectedPage ? (
              <Card>
                <CardContent className="space-y-5 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      Page {current.pages.findIndex((p) => p.id === selectedPage.id) + 1}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => removePage(selectedPage.id)}
                        aria-label="Remove page"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedPageId(null)}
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Page label</label>
                    <Input
                      placeholder="e.g. Cover, Interview with…"
                      value={selectedPage.label}
                      onChange={(e) => patchPage(selectedPage.id, { label: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FLAT_PLAN_STATUSES.map((status) => {
                        const active = selectedPage.status === status.key;
                        return (
                          <button
                            key={status.key}
                            type="button"
                            onClick={() => patchPage(selectedPage.id, { status: status.key as FlatPlanStatusKey })}
                            className={[
                              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                              active ? 'border-accent bg-accent/10 font-medium' : 'border-border hover:bg-muted',
                            ].join(' ')}
                          >
                            <span className={`h-3 w-3 rounded-full ${status.swatchClass}`} />
                            {status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Notes</label>
                    <Textarea
                      placeholder="Production notes for this page…"
                      rows={4}
                      value={selectedPage.notes || ''}
                      onChange={(e) => patchPage(selectedPage.id, { notes: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                Select a page to edit its label, status and notes. Drag pages to re-order.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
