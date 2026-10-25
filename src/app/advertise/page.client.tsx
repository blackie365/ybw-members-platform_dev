'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { PublicCatalogue, PublicSlot } from '@/features/advertising/server/catalogue';

const KIND_ORDER = ['ad', 'directory', 'classified'] as const;

const KIND_HEADING: Record<string, { title: string; blurb: string }> = {
  ad: {
    title: 'Display adverts & advertorials',
    blurb:
      'Full, half and quarter page space in the magazine, plus advertorials written in our voice.',
  },
  directory: {
    title: 'Directory listings',
    blurb: 'A permanent entry in the printed Directory, in front of every reader.',
  },
  classified: {
    title: 'Classifieds',
    blurb: 'Short boxed adverts, grouped by trade.',
  },
};

const money = (pence: number) =>
  `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AdvertiseClient({
  catalogue,
  cancelled,
}: {
  catalogue: PublicCatalogue;
  cancelled: boolean;
}) {
  const [selected, setSelected] = useState<PublicSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<{ ref: string; message: string } | null>(null);
  const [form, setForm] = useState({
    client: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    paidCategory: '',
    bodyHtml: '',
  });

  const grouped = useMemo(
    () => KIND_ORDER.map((kind) => ({ kind, slots: catalogue.slots.filter((s) => s.kind === kind) })),
    [catalogue.slots],
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setManual(null);
    try {
      const res = await fetch('/api/advertise/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotKey: selected.key, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Something went wrong. Please try again.');
        return;
      }
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setManual({
        ref: String(data?.bookingRef || ''),
        message: String(data?.message || 'Booking recorded. We will be in touch.'),
      });
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-background">
      {/* Hero */}
      <div className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-accent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Advertise with us
          </p>
          <h1 className="mt-4 font-serif text-4xl font-medium text-primary-foreground sm:text-5xl lg:text-6xl">
            Space in Yorkshire Businesswoman
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Put your business in front of Yorkshire’s businesswomen — in the magazine and on the
            site. Reserve your space below and pay by card.
          </p>
          {!catalogue.noIssueOpen && catalogue.issueLabel && (
            <p className="mt-6 text-sm text-primary-foreground/70">
              Now booking: <span className="font-semibold">{catalogue.issueLabel}</span>
              {catalogue.issuePublishDate ? ` — publishing ${fmtDate(catalogue.issuePublishDate)}` : ''}
              {catalogue.bookingClosesAt ? `. Bookings close ${fmtDate(catalogue.bookingClosesAt)}.` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {cancelled && (
          <div className="mb-8 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground">
            Your payment was cancelled. Nothing has been charged.
          </div>
        )}

        {catalogue.noIssueOpen && (
          <div className="mb-10 rounded-lg border border-border bg-secondary px-5 py-4">
            <p className="font-medium text-foreground">The next issue is not open for booking yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The rate card below is current. Email{' '}
              <a className="underline" href="mailto:editor@yorkshirebusinesswoman.co.uk">
                editor@yorkshirebusinesswoman.co.uk
              </a>{' '}
              and we will hold space for you.
            </p>
          </div>
        )}

        {manual && (
          <div className="mb-10 rounded-lg border border-accent/40 bg-accent/5 px-5 py-4">
            <p className="font-medium text-foreground">
              Booking {manual.ref} recorded.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{manual.message}</p>
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          {/* Rate card */}
          <div className="space-y-12">
            {grouped.map(({ kind, slots }) =>
              slots.length === 0 ? null : (
                <section key={kind}>
                  <h2 className="font-serif text-2xl font-medium text-foreground">
                    {KIND_HEADING[kind]?.title ?? kind}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{KIND_HEADING[kind]?.blurb}</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {slots.map((s) => {
                      const soldOut = s.isFull || s.remaining === 0;
                      const disabled = catalogue.noIssueOpen || soldOut;
                      const isSelected = selected?.key === s.key;
                      return (
                        <Card
                          key={s.key}
                          className={
                            'transition ' +
                            (isSelected ? 'ring-2 ring-accent ' : '') +
                            (disabled ? 'opacity-60' : 'hover:border-accent/50')
                          }
                        >
                          <CardContent className="flex h-full flex-col p-5">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-medium text-foreground">{s.label}</h3>
                              {soldOut && <Badge variant="secondary">Full</Badge>}
                            </div>
                            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.blurb}</p>
                            <div className="mt-4">
                              <p className="font-serif text-2xl text-foreground">{s.priceLabel}</p>
                              {s.memberPriceLabel && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Members {s.memberPriceLabel} — arrange with the editor
                                </p>
                              )}
                              {!catalogue.noIssueOpen && !soldOut && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {s.remaining} left
                                </p>
                              )}
                            </div>
                            <Button
                              className="mt-4 w-full"
                              variant={isSelected ? 'default' : 'outline'}
                              disabled={disabled}
                              onClick={() => {
                                setSelected(s);
                                setManual(null);
                                setError(null);
                                document
                                  .getElementById('reserve')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              {soldOut ? 'Full' : isSelected ? 'Selected' : 'Reserve this space'}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>

          {/* Reserve panel */}
          <div id="reserve" className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-serif text-xl font-medium text-foreground">Reserve your space</h2>
                {!selected ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Choose a package on the left to start your booking.
                  </p>
                ) : (
                  <form onSubmit={submit} className="mt-4 space-y-3">
                    <div className="rounded-md bg-secondary px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{selected.label}</span>
                      <span className="ml-2 text-muted-foreground">{selected.priceLabel}</span>
                    </div>
                    <Input required placeholder="Business name" value={form.client} onChange={set('client')} />
                    <Input placeholder="Your name" value={form.contactName} onChange={set('contactName')} />
                    <Input
                      required
                      type="email"
                      placeholder="Email address"
                      value={form.contactEmail}
                      onChange={set('contactEmail')}
                    />
                    <Input placeholder="Phone (optional)" value={form.contactPhone} onChange={set('contactPhone')} />
                    <Input
                      placeholder="Website (optional)"
                      value={form.websiteUrl}
                      onChange={set('websiteUrl')}
                    />
                    {(selected.kind === 'directory' || selected.kind === 'classified') && (
                      <Input
                        placeholder="Trade / category (e.g. Solicitors)"
                        value={form.paidCategory}
                        onChange={set('paidCategory')}
                      />
                    )}
                    {selected.bodyMaxChars > 0 && (
                      <div>
                        <textarea
                          className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Your copy — we will lay it out for you"
                          maxLength={selected.bodyMaxChars}
                          value={form.bodyHtml}
                          onChange={set('bodyHtml')}
                        />
                        <p className="mt-1 text-right text-xs text-muted-foreground">
                          {form.bodyHtml.length}/{selected.bodyMaxChars}
                        </p>
                      </div>
                    )}
                    {selected.requiresSuppliedPdf && (
                      <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                        After payment we will email you to request your print-ready PDF
                        (176 × 253mm including 3mm bleed — 170 × 247mm trim).
                      </p>
                    )}
                    {error && (
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-white" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Pay {selected.priceLabel}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Card payment is handled securely by Stripe. Nothing is published until the
                      editor has reviewed your booking.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
