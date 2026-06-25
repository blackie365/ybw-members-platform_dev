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

function getSelectedRange(rangeParam?: string): WebStatsRange {
  if (rangeParam === "90d" || rangeParam === "365d") {
    return rangeParam;
  }
  return "30d";
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

function getChange(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function getChangeTone(change: number | null) {
  if (change === null) {
    return "bg-muted text-muted-foreground border-transparent";
  }
  if (change > 0) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  if (change < 0) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }
  return "bg-muted text-muted-foreground border-transparent";
}

function formatChange(change: number | null) {
  if (change === null) {
    return "No prior data";
  }
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs previous`;
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

function buildNarrative(report: Ga4WebStatsReport) {
  const topChannel = report.channels[0];
  const topPage = report.topPages[0];
  const topCountry = report.countries[0];
  const usersChange = getChange(
    report.summary.current.totalUsers,
    report.summary.previous.totalUsers,
  );

  return [
    `The site attracted ${formatInteger(report.summary.current.totalUsers)} users across ${formatInteger(report.summary.current.sessions)} sessions in ${report.rangeLabel.toLowerCase()}. ${formatChange(usersChange)}.`,
    topChannel
      ? `${topChannel.channel} was the strongest acquisition channel, contributing ${formatInteger(topChannel.sessions)} sessions.`
      : "Channel data will appear here once GA4 returns source breakdowns.",
    topPage
      ? `"${topPage.title}" was the most viewed page with ${formatInteger(topPage.pageViews)} page views.`
      : "Top content data will appear here once page-level reporting is available.",
    topCountry
      ? `${topCountry.country} delivered the largest audience concentration by country.`
      : "Geographic distribution will appear here once country data is returned.",
  ];
}

function MetricCard({
  label,
  value,
  supporting,
  change,
}: {
  label: string;
  value: string;
  supporting: string;
  change: number | null;
}) {
  return (
    <Card className="border-accent/10">
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className="flex items-center justify-between gap-3">
          <div className="font-serif text-3xl font-bold text-foreground">
            {value}
          </div>
          <Badge variant="outline" className={getChangeTone(change)}>
            {formatChange(change)}
          </Badge>
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
  const requestedRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = getSelectedRange(requestedRange);

  let report: Ga4WebStatsReport | null = null;
  let errorMessage: string | null = null;

  try {
    report = await getGa4WebStatsReport(range);
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
  const maxCountryUsers = Math.max(
    ...report.countries.map((point) => point.users),
    1,
  );
  const narrative = buildNarrative(report);

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

      <Card className="border-accent/10 print:border-0 print:shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-serif text-2xl">
                Yorkshire Businesswoman Web Performance Report
              </CardTitle>
              <CardDescription className="mt-1">
                {report.rangeLabel} | {report.currentRange.startDate} to{" "}
                {report.currentRange.endDate}
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
          change={getChange(
            report.summary.current.totalUsers,
            report.summary.previous.totalUsers,
          )}
        />
        <MetricCard
          label="Sessions"
          value={formatInteger(report.summary.current.sessions)}
          supporting="Total visits recorded in GA4"
          change={getChange(
            report.summary.current.sessions,
            report.summary.previous.sessions,
          )}
        />
        <MetricCard
          label="Page Views"
          value={formatInteger(report.summary.current.pageViews)}
          supporting="Total page and screen views"
          change={getChange(
            report.summary.current.pageViews,
            report.summary.previous.pageViews,
          )}
        />
        <MetricCard
          label="New Users"
          value={formatInteger(report.summary.current.newUsers)}
          supporting="First-time visitors recorded by GA4"
          change={getChange(
            report.summary.current.newUsers,
            report.summary.previous.newUsers,
          )}
        />
        <MetricCard
          label="Engagement Rate"
          value={formatPercent(report.summary.current.engagementRate)}
          supporting="Share of engaged sessions"
          change={getChange(
            report.summary.current.engagementRate,
            report.summary.previous.engagementRate,
          )}
        />
        <MetricCard
          label="Avg Session"
          value={formatDuration(report.summary.current.averageSessionDuration)}
          supporting="Average session duration"
          change={getChange(
            report.summary.current.averageSessionDuration,
            report.summary.previous.averageSessionDuration,
          )}
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
            <CardTitle className="font-serif">Device Split</CardTitle>
            <CardDescription>
              Session mix by device category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.devices.map((device) => (
              <div
                key={device.device}
                className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {device.device}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatInteger(device.users)} users
                  </div>
                </div>
                <div className="font-serif text-2xl font-bold text-foreground">
                  {formatInteger(device.sessions)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Top Territories</CardTitle>
            <CardDescription>
              Highest-user countries in the selected range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.countries.map((country) => (
              <div key={country.country} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {country.country}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatInteger(country.users)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{
                      width: `${Math.max((country.users / maxCountryUsers) * 100, 8)}%`,
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
