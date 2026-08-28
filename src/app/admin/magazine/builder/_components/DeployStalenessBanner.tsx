'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type StalenessAPI = {
  isStale: boolean;
  detectedAt: Date | null;
  currentBuildId: string | null;
  newBuildId: string | null;
  markStaleFromError: (reason: string) => void;
};

const STALE_WINDOW_KEY = '__YBW_MAG_BUILDER_CURRENT_BUILD_ID__';
const POLL_MS = 45_000;

function isActionNotFoundError(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') {
    if (/Failed to find Server Action/i.test(err)) return err;
    return null;
  }
  if (err instanceof Error) {
    const msg = err.message || '';
    if (/Failed to find Server Action/i.test(msg)) return msg;
  }
  const asObj = err as Record<string, unknown> | null | undefined;
  if (!asObj) return null;
  const digest = typeof asObj.digest === 'string' ? asObj.digest : '';
  const errMsg = typeof asObj.message === 'string' ? asObj.message : '';
  const errorStr = typeof asObj.error === 'string' ? asObj.error : '';
  const combined = `${digest}\n${errMsg}\n${errorStr}`;
  if (/Failed to find Server Action/i.test(combined)) return combined;
  return null;
}

function readStoredCurrentBuildId(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as Record<string, unknown>;
    const stored = (w as Record<string, unknown>)[STALE_WINDOW_KEY];
    if (typeof stored === 'string' && stored.length > 0) return stored;
    return null;
  } catch {
    return null;
  }
}

function writeStoredCurrentBuildId(id: string): void {
  try {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>)[STALE_WINDOW_KEY] = id;
  } catch {
    /* noop */
  }
}

async function fetchBuildManifestBuildId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    const res = await fetch('/_next/build-manifest.json', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && typeof json.buildId === 'string' && json.buildId.length > 0) {
      return json.buildId;
    }
    return null;
  } catch {
    return null;
  }
}

function useBuildStaleness(): StalenessAPI {
  const [isStale, setIsStale] = useState<boolean>(false);
  const [detectedAt, setDetectedAt] = useState<Date | null>(null);
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(readStoredCurrentBuildId());
  const [newBuildId, setNewBuildId] = useState<string | null>(null);

  const markStaleFromError = useCallback((reason: string) => {
    if (isStale) return;
    console.warn('[DeployStaleness] stale deploy detected from server action error:', reason);
    setIsStale(true);
    setDetectedAt(new Date());
    toast.error(
      'New version deployed — your browser is running an older build and saves will silently fail.',
      {
        description: 'Click Reload App in the banner to load the latest version and keep your work safe.',
        duration: 12_000,
        closeButton: true,
      },
    );
  }, [isStale]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined') return;

    async function initialCapture(): Promise<void> {
      if (cancelled) return;
      const existing = readStoredCurrentBuildId();
      if (!existing) {
        const fetched = await fetchBuildManifestBuildId();
        if (cancelled || !fetched) return;
        writeStoredCurrentBuildId(fetched);
        setCurrentBuildId(fetched);
      }
    }
    initialCapture();

    async function pollOnce(): Promise<void> {
      if (cancelled) return;
      const base = readStoredCurrentBuildId();
      if (!base) {
        const first = await fetchBuildManifestBuildId();
        if (!cancelled && first) {
          writeStoredCurrentBuildId(first);
          setCurrentBuildId(first);
        }
        return;
      }
      const latest = await fetchBuildManifestBuildId();
      if (cancelled || !latest) return;
      if (base !== latest) {
        setNewBuildId(latest);
        setIsStale(true);
        setDetectedAt(new Date());
        console.warn(
          `[DeployStaleness] build id changed via poll: was ${base}, now ${latest}`,
        );
        toast.warning(
          'New magazine builder version is live. Reload soon to avoid save failures from stale action IDs.',
          {
            description: 'Use the banner button or Cmd/Ctrl+Shift+R to reload safely.',
            duration: 18_000,
            closeButton: true,
          },
        );
      }
    }

    pollOnce();
    const t = setInterval(pollOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return { isStale, detectedAt, currentBuildId, newBuildId, markStaleFromError };
}

export { useBuildStaleness, isActionNotFoundError };
export type { StalenessAPI };

export function DeployStalenessBanner({ api }: { api: StalenessAPI }) {
  const [reloading, setReloading] = useState(false);
  const reloadApp = useCallback(() => {
    try {
      if (typeof window !== 'object' || !window.location) return;
      setReloading(true);
      toast.success('Reloading latest magazine builder...');
      setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      if (typeof window !== 'undefined') window.location.reload();
    }
  }, []);

  if (!api.isStale) return null;

  const detectedAtText =
    api.detectedAt && typeof api.detectedAt.toLocaleTimeString === 'function'
      ? api.detectedAt.toLocaleTimeString()
      : '';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 flex w-full flex-col gap-3 rounded-2xl border border-amber-400/60 bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 px-5 py-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-amber-900">
            New magazine builder version deployed
            {detectedAtText ? ` · detected ${detectedAtText}` : ''}
          </p>
          <p className="text-xs leading-relaxed text-amber-800/90">
            Your tab is still running an older build and <strong>saves will silently fail</strong>
            because Next.js Server Action IDs have changed. Reload once to get the latest
            fast-save bundle and keep your edits flowing through correctly.
          </p>
          {api.currentBuildId || api.newBuildId ? (
            <p className="font-mono text-[10px] tracking-tight text-amber-900/70">
              {api.currentBuildId ? `loaded: ${api.currentBuildId.slice(0, 10)}…` : ''}
              {api.currentBuildId && api.newBuildId ? ' ⇒ ' : ''}
              {api.newBuildId ? `live: ${api.newBuildId.slice(0, 10)}…` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 sm:ml-4">
        <Button
          type="button"
          variant="default"
          onClick={reloadApp}
          disabled={reloading}
          className="w-full bg-amber-600 text-white shadow hover:bg-amber-700 sm:w-auto"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${reloading ? 'animate-spin' : ''}`}
            aria-hidden
          />
          {reloading ? 'Reloading…' : 'Reload App'}
        </Button>
      </div>
    </div>
  );
}
