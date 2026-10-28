'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  decideSocialPostAction,
  getSocialOverviewAction,
  queueNextSocialPostAction,
  unskipSocialPostAction,
  type SocialOverview,
} from '@/app/actions/socialActions';
import type { SocialQueueRow, SocialStatus } from '@/features/social/server/social-store';

/**
 * Social screen — the "send on approval" surface.
 *
 * The daily timer queues an article and emails it; this page is the same
 * decision without the email, plus a button to queue the next article on
 * demand. Posting is only possible when SOCIAL_PUBLISH_ENABLED=true on the
 * deploy — the banner below says so when it is off.
 */

const TARGET_LABELS: Record<string, string> = {
  facebook_page: 'Facebook Page',
  instagram_feed: 'Instagram feed',
  instagram_story: 'Instagram Story',
};

const STATUS_VARIANT: Record<SocialStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  skipped: 'outline',
  failed: 'destructive',
};

function formatWhen(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SocialAdminPage() {
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueing, setQueueing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await getSocialOverviewAction();
    if (res.success && res.overview) {
      setOverview(res.overview);
    } else {
      toast.error(res.error || 'Failed to load the social queue');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleQueueNext = async () => {
    setQueueing(true);
    const res = await queueNextSocialPostAction();
    if (res.success) {
      if (res.result?.queued) {
        toast.success(`Queued “${res.result.article?.title}” — approval email sent.`);
      } else {
        toast.info(res.result?.reason || 'Nothing new to queue.');
      }
      await load();
    } else {
      toast.error(res.error || 'Queueing failed');
    }
    setQueueing(false);
  };

  const handleDecision = async (row: SocialQueueRow, decision: 'approved' | 'skipped') => {
    const label = row.title || row.slug || `#${row.id}`;
    const confirmed =
      decision === 'skipped'
        ? window.confirm(`Skip “${label}”? It will not be posted.`)
        : window.confirm(
            `Post “${label}” now to ${(row.targets || [])
              .map((t) => TARGET_LABELS[t] || t)
              .join(', ')}? This publishes to the live accounts immediately.`,
          );
    if (!confirmed) return;

    setBusyId(row.id);
    const res = await decideSocialPostAction(row.id, decision);
    if (res.success && res.result) {
      if (res.result.status === 'published' || res.result.status === 'skipped') {
        toast.success(res.result.message);
      } else if (res.result.status === 'already-handled') {
        toast.info(res.result.message);
      } else {
        toast.warning(res.result.message);
      }
    } else {
      toast.error(res.error || 'Action failed');
    }
    await load();
    setBusyId(null);
  };

  const handleUnskip = async (row: SocialQueueRow) => {
    const label = row.title || row.slug || `#${row.id}`;
    if (!window.confirm(`Put “${label}” back in the queue?`)) return;

    setBusyId(row.id);
    const res = await unskipSocialPostAction(row.id);
    if (res.success && res.result) {
      if (res.result.status === 'reopened') {
        toast.success(res.result.message);
      } else {
        toast.info(res.result.message);
      }
    } else {
      toast.error(res.error || 'Action failed');
    }
    await load();
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Loading social queue…</p>
      </div>
    );
  }

  const rows = overview?.rows ?? [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <Share2 className="h-7 w-7 text-accent" />
            Social
          </h1>
          <p className="text-muted-foreground mt-1">
            Approve and post YBW articles to Facebook and Instagram. One article is queued each
            morning at 09:00 and emailed to you; nothing is published until you post it here.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleQueueNext}
            disabled={queueing}
            className="bg-accent hover:bg-accent/90"
          >
            {queueing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Queue next article
          </Button>
        </div>
      </div>

      {!overview?.publishEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Posting is switched off on this deploy.</p>
            <p className="mt-1">
              You can queue and review articles, but the Post button will not reach Facebook or
              Instagram until <code className="font-mono">SOCIAL_PUBLISH_ENABLED=true</code> is set
              in <code className="font-mono">/srv/ybw-frontend/.env.local</code> and the service is
              restarted. This needs{' '}
              <code className="font-mono">pages_manage_posts</code> and{' '}
              <code className="font-mono">instagram_content_publish</code> on the Meta token.
            </p>
          </div>
        </div>
      )}

      {!overview?.cronConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">The daily 09:00 queue job is not configured.</p>
            <p className="mt-1">
              <code className="font-mono">CRON_SECRET</code> is missing, so the timer&apos;s call
              will be rejected. You can still queue articles manually with the button above.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Queue</CardTitle>
          <CardDescription>
            Newest first. Each article is queued once — a posted or skipped article is never queued
            again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nothing queued yet. Use “Queue next article” to add the most recent story.
            </div>
          ) : (
            <ul className="space-y-6">
              {rows.map((row) => (
                <li key={row.id} className="flex gap-5 border-b last:border-b-0 pb-6 last:pb-0">
                  {row.slug ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/social/card/${encodeURIComponent(row.slug)}?format=portrait`}
                      alt=""
                      className="hidden sm:block w-28 shrink-0 rounded border bg-muted object-cover"
                    />
                  ) : null}

                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-serif font-semibold text-foreground">
                          {row.title || row.slug}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Queued {formatWhen(row.queued_at)}
                          {row.published_at ? ` · posted ${formatWhen(row.published_at)}` : ''}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(row.targets || []).map((t) => (
                        <Badge key={t} variant="outline" className="font-normal">
                          {TARGET_LABELS[t] || t}
                        </Badge>
                      ))}
                    </div>

                    {row.caption_fb ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Captions
                        </summary>
                        <div className="mt-2 space-y-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Facebook
                            </p>
                            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                              {row.caption_fb}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Instagram
                            </p>
                            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                              {row.caption_ig}
                            </pre>
                          </div>
                          {row.url ? (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline text-sm"
                            >
                              {row.url}
                            </a>
                          ) : null}
                        </div>
                      </details>
                    ) : null}

                    {row.error ? (
                      <p className="text-xs text-destructive">{row.error}</p>
                    ) : null}

                    {row.status === 'pending' ? (
                      <div className="flex gap-3 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleDecision(row, 'approved')}
                          disabled={busyId === row.id}
                          className="bg-accent hover:bg-accent/90"
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Post now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecision(row, 'skipped')}
                          disabled={busyId === row.id}
                        >
                          <SkipForward className="h-4 w-4 mr-2" />
                          Skip
                        </Button>
                      </div>
                    ) : null}

                    {row.status === 'skipped' ? (
                      <div className="flex gap-3 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnskip(row)}
                          disabled={busyId === row.id}
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-2" />
                          )}
                          Un-skip
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
