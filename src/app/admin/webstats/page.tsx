import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintReportButton } from "@/components/admin/PrintReportButton";
import {
  type Ga4TrendPoint,
  type Ga4DateRangeOptions,
  type Ga4WebStatsReport,
  getGa4WebStatsReport,
  type WebStatsRange,
} from "@/lib/server/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGE_OPTIONS: Array<{ value: WebStatsRange; label: string }> = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "12 months" },
];

function getSelectedRange(rangeParam?: string) {
  if (rangeParam === "90d" || rangeParam === "365d") {
    return rangeParam;
  }
  return "30d";
}

function getRequestedValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getYesterdayIso() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function safeRatio(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function formatPercentFromRatio(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function clampWidth(value: number, minimum = 6) {
  return `${Math.max(value, minimum)}%`;
}

function buildNarrative(report: Ga4WebStatsReport) {
  const topChannel = report.channels[0];
  const topPage = report.topPages[0];
  const newUserShare = safeRatio(
    report.summary.current.newUsers,
    report.summary.current.totalUsers,
  );
  const pagesPerSession = safeRatio(
    report.summary.current.pageViews,
    report.summary.current.sessions,
  );

  return [
    `The site reached ${formatInteger(report.summary.current.totalUsers)} users and generated ${formatInteger(report.summary.current.sessions)} sessions during this period.`,
    `New visitors accounted for ${formatPercentFromRatio(newUserShare)} of the audience, showing strong discovery and fresh reach.`,
    `Visitors viewed ${pagesPerSession.toFixed(1)} pages per session on average, giving the report a healthy content-consumption story.`,
    topChannel
      ? `${topChannel.channel} remained the strongest acquisition source, bringing in ${formatInteger(topChannel.sessions)} sessions.`
      : "Channel mix will appear here once GA4 returns source breakdowns.",
    topPage
      ? `"${topPage.title}" led content performance with ${formatInteger(topPage.pageViews)} page views.`
      : "Top content data will appear here once page-level reporting is available.",
  ];
}

function compactTrend(points: Ga4TrendPoint[], maxPoints = 12) {
  if (points.length <= maxPoints) {
    return points;
  }

  const bucketSize = Math.ceil(points.length / maxPoints);
  const compacted: Ga4TrendPoint[] = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const bucket = points.slice(index, index + bucketSize);
    const totalUsers = bucket.reduce((sum, point) => sum + point.users, 0);
    const totalSessions = bucket.reduce((sum, point) => sum + point.sessions, 0);
    const totalPageViews = bucket.reduce((sum, point) => sum + point.pageViews, 0);
    const lastPoint = bucket[bucket.length - 1];

    compacted.push({
      date: lastPoint.date,
      label: lastPoint.label,
      users: Math.round(totalUsers / bucket.length),
      sessions: Math.round(totalSessions / bucket.length),
      pageViews: Math.round(totalPageViews / bucket.length),
    });
  }

  return compacted;
}

function getReportRequest(params: Record<string, string | string[] | undefined>) {
  const startDate = getRequestedValue(params.startDate);
  const endDate = getRequestedValue(params.endDate);

  if (startDate && endDate) {
    return {
      startDate,
      endDate,
    } satisfies Ga4DateRangeOptions;
  }

  return {
    range: getSelectedRange(getRequestedValue(params.range)),
  } satisfies Ga4DateRangeOptions;
}

function MetricCard({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <Card className="border-accent/10">
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className="font-serif text-3xl font-bold text-foreground">
          {value}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{supporting}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminWebStatsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedStartDate = getRequestedValue(params.startDate);
  const requestedEndDate = getRequestedValue(params.endDate);
  const request = getReportRequest(params);

  let report: Ga4WebStatsReport | null = null;
  let errorMessage: string | null = null;

  try {
    report = await getGa4WebStatsReport(request);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to load GA4 web statistics.";
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Web Stats
            </h1>
            <p className="mt-1 text-muted-foreground">
              Private GA4 reporting for client-ready site performance snapshots
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">GA4 connection required</CardTitle>
            <CardDescription>
              The page is protected and ready, but the server could not load data
              from GA4.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {errorMessage || "Unknown GA4 error."}
            </p>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Required server environment variables:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <code>GA4_PROPERTY_ID</code>
                </li>
                <li>
                  <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>
                </li>
                <li>
                  <code>GOOGLE_PRIVATE_KEY</code>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const condensedTrend = compactTrend(report.trend, 12);
  const maxTrendUsers = Math.max(...condensedTrend.map((point) => point.users), 1);
  const maxChannelSessions = Math.max(
    ...report.channels.map((point) => point.sessions),
    1,
  );
  const maxTopPageViews = Math.max(
    ...report.topPages.slice(0, 5).map((point) => point.pageViews),
    1,
  );
  const narrative = buildNarrative(report);
  const yesterdayIso = getYesterdayIso();
  const newUserShare = safeRatio(
    report.summary.current.newUsers,
    report.summary.current.totalUsers,
  );
  const pagesPerSession = safeRatio(
    report.summary.current.pageViews,
    report.summary.current.sessions,
  );
  const sessionsPerUser = safeRatio(
    report.summary.current.sessions,
    report.summary.current.totalUsers,
  );
  const topPageShare = safeRatio(
    report.topPages[0]?.pageViews ?? 0,
    report.summary.current.pageViews,
  );
  const selectedStartDate = requestedStartDate ?? report.currentRange.startDate;
  const selectedEndDate = requestedEndDate ?? report.currentRange.endDate;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Web Stats
          </h1>
          <p className="mt-1 text-muted-foreground">
            GA4 reporting for client-ready web performance snapshots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              asChild
              variant={option.value === report.range ? "default" : "outline"}
              size="sm"
            >
              <Link href={`/admin/webstats?range=${option.value}`}>
                {option.label}
              </Link>
            </Button>
          ))}
          <PrintReportButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="font-serif">Report Period</CardTitle>
          <CardDescription>
            Use quick ranges or choose a custom calendar period for this report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/webstats" method="get" className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Start date
              <Input
                type="date"
                name="startDate"
                defaultValue={selectedStartDate}
                max={yesterdayIso}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              End date
              <Input
                type="date"
                name="endDate"
                defaultValue={selectedEndDate}
                max={yesterdayIso}
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit">Apply period</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/webstats?range=30d">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-accent/10 print:border-0 print:shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-serif text-2xl">
                Yorkshire Businesswoman Web Performance Report
              </CardTitle>
              <CardDescription className="mt-1">
                {report.rangeLabel} | {formatDateLabel(report.currentRange.startDate)} to{" "}
                {formatDateLabel(report.currentRange.endDate)}
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit bg-muted/50">
              Generated {new Date(report.generatedAt).toLocaleString("en-GB")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm text-muted-foreground">
            {narrative.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total Users"
          value={formatInteger(report.summary.current.totalUsers)}
          supporting="Distinct users across the selected reporting period"
        />
        <MetricCard
          label="Sessions"
          value={formatInteger(report.summary.current.sessions)}
          supporting="Total visits recorded in GA4"
        />
        <MetricCard
          label="Page Views"
          value={formatInteger(report.summary.current.pageViews)}
          supporting="Total page and screen views"
        />
        <MetricCard
          label="New Users"
          value={formatInteger(report.summary.current.newUsers)}
          supporting="First-time visitors recorded by GA4"
        />
        <MetricCard
          label="Engagement Rate"
          value={formatPercent(report.summary.current.engagementRate)}
          supporting="Share of engaged sessions"
        />
        <MetricCard
          label="Avg Session"
          value={formatDuration(report.summary.current.averageSessionDuration)}
          supporting="Average session duration"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Audience Trend</CardTitle>
            <CardDescription>
              Averaged into up to 12 points for a clean print-friendly summary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {condensedTrend.map((point) => (
              <div
                key={point.date}
                className="grid grid-cols-[72px_1fr_64px] items-center gap-3"
              >
                <span className="text-sm text-muted-foreground">
                  {point.label}
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.max((point.users / maxTrendUsers) * 100, 4)}%`,
                    }}
                  />
                </div>
                <span className="text-right text-sm font-medium text-foreground">
                  {formatInteger(point.users)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Traffic Sources</CardTitle>
            <CardDescription>
              Sessions grouped by GA4 default channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.channels.map((channel) => (
              <div key={channel.channel} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {channel.channel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatInteger(channel.users)} users
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatInteger(channel.sessions)}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#b79c65]"
                    style={{
                      width: `${Math.max((channel.sessions / maxChannelSessions) * 100, 6)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Audience Snapshot</CardTitle>
            <CardDescription>
              Client-friendly highlights that reinforce scale and attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  New audience share
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatPercentFromRatio(newUserShare)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: clampWidth(newUserShare * 100, 10) }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="rounded-xl border bg-muted/20 p-4"
              >
                <div className="text-sm font-medium text-muted-foreground">
                  Pages per session
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                  {pagesPerSession.toFixed(1)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Average content depth per visit
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Sessions per user
                </div>
                <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                  {sessionsPerUser.toFixed(1)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Repeat visit activity during the period
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Top page contribution
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatPercentFromRatio(topPageShare)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#b79c65]"
                  style={{ width: clampWidth(topPageShare * 100, 8) }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Share of all page views generated by the strongest single page
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Device Split</CardTitle>
            <CardDescription>
              Session mix by device category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.devices.map((device) => (
              <div key={device.device} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {device.device}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {formatInteger(device.users)} users
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {formatInteger(device.sessions)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercentFromRatio(
                        safeRatio(device.sessions, report.summary.current.sessions),
                      )}
                    </div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{
                      width: clampWidth(
                        safeRatio(device.sessions, report.summary.current.sessions) * 100,
                        8,
                      ),
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Content Highlights</CardTitle>
          <CardDescription>
            Strongest-performing pages by view volume
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.topPages.slice(0, 5).map((page) => (
            <div key={`${page.path}-${page.title}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {page.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {page.path}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {formatInteger(page.pageViews)} views
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatInteger(page.users)} users
                  </div>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: clampWidth(
                      safeRatio(page.pageViews, maxTopPageViews) * 100,
                      10,
                    ),
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Top Pages</CardTitle>
          <CardDescription>
            Most-viewed pages for the selected reporting period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topPages.map((page) => (
                <TableRow key={`${page.path}-${page.title}`}>
                  <TableCell className="max-w-[280px] whitespace-normal font-medium">
                    {page.title}
                  </TableCell>
                  <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                    {page.path}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatInteger(page.pageViews)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatInteger(page.users)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
