'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type IssueOption = { id: string; label: string; publishDate: string; closed: boolean };

type Capacity = {
  slotKey: string;
  label: string;
  kind: string;
  committed: number;
  capacity: number;
  remaining: number;
  isFull: boolean;
};

type AdminBooking = {
  id: number;
  bookingRef: string;
  issueId: string;
  issueLabel: string;
  kind: string;
  slotKey: string;
  slotLabel: string;
  status: 'enquiry' | 'paid' | 'approved' | 'rejected' | 'cancelled';
  client: string;
  paidCategory: string | null;
  bodyHtml: string | null;
  logoUrl: string | null;
  placementSize: string | null;
  memberRate: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  amountPence: number;
  amountLabel: string;
  paidAt: string | null;
  editorialNote: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

type AdminPayload = {
  issue: { id: string; label: string; publishDate: string; bookingClosesAt: string; closed: boolean } | null;
  issues: IssueOption[];
  availability: Capacity[];
  bookings: AdminBooking[];
};

const STATUS_VARIANT: Record<AdminBooking['status'], string> = {
  enquiry: 'bg-secondary text-secondary-foreground',
  paid: 'bg-blue-100 text-blue-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900',
  cancelled: 'bg-secondary text-muted-foreground',
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdvertisingAdminPage() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [issueId, setIssueId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AdminBooking['status']>('all');

  const load = useCallback(
    async (id?: string) => {
      setLoading(true);
      try {
        const qs = id ? `?issueId=${encodeURIComponent(id)}` : '';
        const res = await fetch(`/api/advertise/admin${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const payload: AdminPayload = await res.json();
        setData(payload);
        if (payload.issue) setIssueId(payload.issue.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load bookings');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, action: 'approve' | 'reject' | 'reset') {
    setBusyId(id);
    try {
      const res = await fetch('/api/advertise/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.detail || body?.error || 'Action failed');
      toast.success(`Booking ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'reopened'}`);
      await load(issueId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  const bookings = (data?.bookings ?? []).filter((b) => statusFilter === 'all' || b.status === statusFilter);
  const waiting = (data?.bookings ?? []).filter((b) => b.status === 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium text-foreground">Advertising</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every booking sold through the shop, by issue. Approving a booking is what puts it into the
            magazine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && data.issues.length > 0 && (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={issueId}
              onChange={(e) => {
                setIssueId(e.target.value);
                void load(e.target.value);
              }}
            >
              {data.issues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                  {i.closed ? ' (closed)' : ''}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" onClick={() => void load(issueId)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading bookings…
        </div>
      )}

      {data && !data.issue && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No magazine issues exist yet. Create one in the magazine builder and the shop will start
            selling into it.
          </CardContent>
        </Card>
      )}

      {data?.issue && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Issue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif text-lg text-foreground">{data.issue.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Publishes {fmtDate(data.issue.publishDate)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bookings close</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif text-lg text-foreground">
                  {fmtDate(data.issue.bookingClosesAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.issue.closed ? 'Closed for new bookings' : 'Still open'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting review</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif text-3xl text-foreground">{waiting}</p>
                <p className="mt-1 text-xs text-muted-foreground">Paid, not yet approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif text-3xl text-foreground">{data.bookings.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">All statuses</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.availability.map((a) => (
                <div key={a.slotKey} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{a.label}</span>
                    {a.isFull && <Badge variant="secondary">Full</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.committed} of {a.capacity} taken — {a.remaining} left
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Bookings</CardTitle>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="enquiry">Enquiry</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookings.length === 0 && (
                <p className="text-sm text-muted-foreground">No bookings match this view.</p>
              )}
              {bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{b.client}</span>
                        <Badge className={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                        {b.memberRate && <Badge variant="secondary">member rate</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.bookingRef} · {b.slotLabel} · {b.amountLabel} ·{' '}
                        {b.paidAt ? `paid ${fmtDate(b.paidAt)}` : `created ${fmtDate(b.createdAt)}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.contactName ? `${b.contactName} · ` : ''}
                        {b.contactEmail || 'no email'}
                        {b.contactPhone ? ` · ${b.contactPhone}` : ''}
                      </p>
                      {b.websiteUrl && (
                        <a
                          href={b.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs text-accent underline"
                        >
                          {b.websiteUrl}
                        </a>
                      )}
                      {b.paidCategory && (
                        <p className="mt-1 text-xs text-muted-foreground">Category: {b.paidCategory}</p>
                      )}
                      {b.bodyHtml && (
                        <p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-md bg-secondary px-3 py-2 text-xs text-foreground">
                          {b.bodyHtml}
                        </p>
                      )}
                      {b.editorialNote && (
                        <p className="mt-2 text-xs italic text-muted-foreground">Note: {b.editorialNote}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="bg-accent hover:bg-accent/90 text-white"
                        disabled={busyId === b.id || b.status === 'approved'}
                        onClick={() => void act(b.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === b.id || b.status === 'rejected'}
                        onClick={() => void act(b.id, 'reject')}
                      >
                        Reject
                      </Button>
                      {(b.status === 'approved' || b.status === 'rejected') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === b.id}
                          onClick={() => void act(b.id, 'reset')}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
