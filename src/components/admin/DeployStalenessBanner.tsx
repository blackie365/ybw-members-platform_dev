'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Detect that the tab is running an older Next.js build than the one on the
 * server.
 *
 * Server Action ids are derived from the build, so after a deploy every action
 * call from a tab that was open before the restart is rejected with
 * "Failed to find Server Action <hash>". Nothing is saved, and callers that do
 * not catch the rejection (or never reset their "busy" flag) look like they
 * simply hang. Shared by the magazine builder and the admin Social screen —
 * both are long-lived admin tabs that survive deploys.
 */

type StalenessAPI = {
  isStale: boolean;
  detectedAt: Date | null;
  currentBuildId: string | null;
  newBuildId: string | null;
  markStaleFromError: (reason: string) => void;
};

const STALE_WINDOW_KEY = '__YBW_CURRENT_BUILD_ID__';
const POLL_MS = 45_000;

// The client throws "Failed to find Server Action <hash>"; the server can also
// answer "Server action not found." (HTTP 404). Both mean the tab's build is
// older than the deploy.
const STALE_ACTION_RE = /Failed to find Server Action|Server action not found|older or newer deployment/i;

export function isActionNotFoundError(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') {
    if (STALE_ACTION_RE.test(err)) return err;
    return null;
  }
  if (err instanceof Error) {
    const msg = err.message || '';
    if (STALE_ACTION_RE.test(msg)) return msg;
  }
  const asObj = err as Record<string, unknown> | null | undefined;
  if (!asObj) return null;
  const digest = typeof asObj.digest === 'string' ? asObj.digest : '';
  const errMsg = typeof asObj.message === 'string' ? asObj.message : '';
  const errorStr = typeof asObj.error === 'string' ? asObj.error : '';
  const combined = `${digest}\n${errMsg}\n${errorStr}`;
  if (STALE_ACTION_RE.test(combined)) return combined;
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
      'New version deployed — this tab is running an older build and actions will silently fail.',
      {
        description: 'Click Reload App in the banner to load the latest version, then try again.',
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
          'New version is live. Reload soon to avoid failures from stale action IDs.',
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

export { useBuildStaleness };
export type { StalenessAPI };

export function DeployStalenessBanner({ api }: { api: StalenessAPI }) {
  const [reloading, setReloading] = useState(false);
  const reloadApp = useCallback(() => {
    try {
      if (typeof window !== 'object' || !window.location) return;
      setReloading(true);
      toast.success('Reloading latest version...');
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
            New version deployed
            {detectedAtText ? ` · detected ${detectedAtText}` : ''}
          </p>
          <p className="text-xs leading-relaxed text-amber-800/90">
            This tab is still running an older build and <strong>actions will silently fail</strong>
            because Next.js Server Action IDs have changed. Reload once, then repeat the action.
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
