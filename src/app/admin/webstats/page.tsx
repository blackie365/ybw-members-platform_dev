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
  type Ga4PropertySource,
  type Ga4TrendPoint,
  type Ga4DateRangeOptions,
  type Ga4WebStatsReport,
  getGa4WebStatsReport,
  type WebStatsRange,
} from "@/lib/server/ga4";
import {
  getSocialMediaReport,
  type SocialMediaReport,
} from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGE_OPTIONS: Array<{ value: WebStatsRange; label: string }> = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "12 months" },
];

const SOURCE_OPTIONS: Array<{ value: Ga4PropertySource; label: string }> = [
  { value: "current", label: "Current" },
  { value: "legacy", label: "Legacy" },
];

const SECTION_OPTIONS = [
  { value: "overview", label: "Executive summary" },
  { value: "summary", label: "Performance snapshot" },
  { value: "trend", label: "Audience reach trend" },
  { value: "sources", label: "Audience acquisition" },
  { value: "snapshot", label: "Engagement snapshot" },
  { value: "devices", label: "Device profile" },
  { value: "highlights", label: "Content performance" },
  { value: "top-pages", label: "Page performance table" },
  { value: "social-summary", label: "Social reach summary" },
  { value: "social-content", label: "Social content highlights" },
] as const;

type ReportSection = (typeof SECTION_OPTIONS)[number]["value"];

function getSelectedRange(rangeParam?: string) {
  if (rangeParam === "90d" || rangeParam === "365d") {
    return rangeParam;
  }
  return "30d";
}

function getSelectedSource(sourceParam?: string): Ga4PropertySource {
  return sourceParam === "legacy" ? "legacy" : "current";
}

function getRequestedValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestedValues(value?: string | string[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
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

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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
  const newUserShare = safeRatio(
    report.summary.current.newUsers,
    report.summary.current.totalUsers,
  );
  const pagesPerSession = safeRatio(
    report.summary.current.pageViews,
    report.summary.current.sessions,
  );
  const engagementRate = formatPercent(report.summary.current.engagementRate);
  const averageSession = formatDuration(
    report.summary.current.averageSessionDuration,
  );

  if (report.propertySource === "legacy") {
    return [
      `Over the selected period, the website delivered ${formatInteger(report.summary.current.totalUsers)} users and ${formatInteger(report.summary.current.sessions)} sessions, giving the brand strong digital visibility and a healthy level of repeat interest.`,
      `New visitors accounted for ${formatPercentFromRatio(newUserShare)} of the audience, while ${formatInteger(report.summary.current.pageViews)} page views and ${pagesPerSession.toFixed(1)} pages per session point to solid discovery and encouraging content consumption.`,
      topChannel
        ? `Engagement remained positive at ${engagementRate}, with an average session time of ${averageSession}; ${topChannel.channel} was the leading traffic source across the reporting window.`
        : `Engagement remained positive at ${engagementRate}, with an average session time of ${averageSession}, reinforcing the strength of the audience response across the reporting window.`,
    ];
  }

  const topPage = report.topPages[0];
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

function buildReportHref({
  source,
  range,
  startDate,
  endDate,
  sections,
}: {
  source: Ga4PropertySource;
  range?: WebStatsRange;
  startDate?: string;
  endDate?: string;
  sections?: ReportSection[];
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("source", source);

  if (startDate && endDate) {
    searchParams.set("startDate", startDate);
    searchParams.set("endDate", endDate);
  } else {
    searchParams.set("range", range ?? "30d");
  }

  if (sections && sections.length > 0 && sections.length < SECTION_OPTIONS.length) {
    for (const section of sections) {
      searchParams.append("sections", section);
    }
  }

  return `/admin/webstats?${searchParams.toString()}`;
}

function getVisibleSections(params: Record<string, string | string[] | undefined>) {
  const requestedSections = new Set(getRequestedValues(params.sections));
  if (requestedSections.size === 0) {
    return SECTION_OPTIONS.map((option) => option.value);
  }

  const validSections = SECTION_OPTIONS
    .map((option) => option.value)
    .filter((value) => requestedSections.has(value));

  return validSections.length > 0
    ? validSections
    : SECTION_OPTIONS.map((option) => option.value);
}

function getAvailableSections(propertySource: Ga4PropertySource) {
  return propertySource === "legacy"
    ? SECTION_OPTIONS.filter(
        (option) => option.value !== "highlights" && option.value !== "top-pages",
      )
    : SECTION_OPTIONS;
}

function getReportRequest(params: Record<string, string | string[] | undefined>) {
  const startDate = getRequestedValue(params.startDate);
  const endDate = getRequestedValue(params.endDate);
  const propertySource = getSelectedSource(getRequestedValue(params.source));

  if (startDate && endDate) {
    return {
      propertySource,
      startDate,
      endDate,
    } satisfies Ga4DateRangeOptions;
  }

  return {
    propertySource,
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
  const visibleSections = getVisibleSections(params);
  const availableSections = getAvailableSections(request.propertySource);
  const availableSectionValues = availableSections.map((section) => section.value);
  const isSectionVisible = (section: ReportSection) =>
    availableSectionValues.includes(section) && visibleSections.includes(section);

  let report: Ga4WebStatsReport | null = null;
  let socialReport: SocialMediaReport | null = null;
  let errorMessage: string | null = null;
  let socialErrorMessage: string | null = null;

  try {
    report = await getGa4WebStatsReport(request);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to load GA4 web statistics.";
  }

  if (report) {
    try {
      socialReport = await getSocialMediaReport({
        startDate: report.currentRange.startDate,
        endDate: report.currentRange.endDate,
      });
    } catch (error) {
      socialErrorMessage =
        error instanceof Error
          ? error.message
          : "Unable to load social media statistics.";
    }
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
                  <code>GA4_PROPERTY_ID_CURRENT</code> or <code>GA4_PROPERTY_ID</code>
                </li>
                <li>
                  <code>GA4_PROPERTY_ID_LEGACY</code> for the legacy report view
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
  const currentRange =
    report.range === "custom" ? undefined : (report.range as WebStatsRange);
  const visibleSectionsInput = visibleSections.map((section) => (
    <input key={section} type="hidden" name="sections" value={section} />
  ));
  const connectedSocialChannels =
    socialReport?.channels.filter((channel) => channel.connected) ?? [];
  const totalSocialFollowers = connectedSocialChannels.reduce(
    (sum, channel) => sum + channel.followers,
    0,
  );
  const totalSocialEngagements = connectedSocialChannels.reduce(
    (sum, channel) => sum + channel.engagements,
    0,
  );
  const totalSocialImpressions = connectedSocialChannels.reduce(
    (sum, channel) => sum + channel.impressions,
    0,
  );
  const totalSocialReach = connectedSocialChannels.reduce(
    (sum, channel) => sum + (channel.reach ?? 0),
    0,
  );
  const totalSocialProfileViews = connectedSocialChannels.reduce(
    (sum, channel) => sum + (channel.profileViews ?? 0),
    0,
  );
  const totalSocialAccountsEngaged = connectedSocialChannels.reduce(
    (sum, channel) => sum + (channel.accountsEngaged ?? 0),
    0,
  );

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Web Performance
          </h1>
          <p className="mt-1 text-muted-foreground">
            GA4 reporting for client-ready web performance snapshots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              asChild
              variant={option.value === report.propertySource ? "default" : "outline"}
              size="sm"
            >
              <Link
                href={buildReportHref({
                  source: option.value,
                  range: currentRange,
                  startDate: requestedStartDate,
                  endDate: requestedEndDate,
                  sections: visibleSections,
                })}
              >
                {option.label}
              </Link>
            </Button>
          ))}
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              asChild
              variant={option.value === report.range ? "default" : "outline"}
              size="sm"
            >
              <Link
                href={buildReportHref({
                  source: report.propertySource,
                  range: option.value,
                  sections: visibleSections,
                })}
              >
                {option.label}
              </Link>
            </Button>
          ))}
          <PrintReportButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="font-serif">Reporting Period</CardTitle>
          <CardDescription>
            Use quick ranges or choose a custom calendar period for this report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/webstats" method="get" className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            {visibleSectionsInput}
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Start date
              <Input
                type="date"
                name="startDate"
                defaultValue={selectedStartDate}
                max={yesterdayIso}
              />
            </label>
            <input type="hidden" name="source" value={report.propertySource} />
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
                <Link
                  href={buildReportHref({
                    source: report.propertySource,
                    range: "30d",
                    sections: visibleSections,
                  })}
                >
                  Reset
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="font-serif">Report Sections</CardTitle>
          <CardDescription>
            Choose which panes appear in the report and exported PDF
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/webstats" method="get" className="space-y-4">
            <input type="hidden" name="source" value={report.propertySource} />
            {currentRange ? (
              <input type="hidden" name="range" value={currentRange} />
            ) : (
              <>
                <input type="hidden" name="startDate" value={selectedStartDate} />
                <input type="hidden" name="endDate" value={selectedEndDate} />
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {availableSections.map((section) => (
                <label
                  key={section.value}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="sections"
                    value={section.value}
                    defaultChecked={isSectionVisible(section.value)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>{section.label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Apply visibility</Button>
              <Button asChild type="button" variant="outline">
                <Link
                  href={buildReportHref({
                    source: report.propertySource,
                    range: currentRange,
                    startDate: requestedStartDate,
                    endDate: requestedEndDate,
                    sections: availableSectionValues,
                  })}
                >
                  Show all
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isSectionVisible("overview") ? (
        <Card className="border-accent/10 print:border-0 print:shadow-none">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-serif text-2xl">
                  Yorkshire Businesswoman Digital Performance Report
                </CardTitle>
                <CardDescription className="mt-1">
                  {report.propertySource === "legacy"
                  ? "Audience performance recap"
                    : "Current live property"}{" "}
                  | {report.rangeLabel} | {formatDateLabel(report.currentRange.startDate)} to{" "}
                  {formatDateLabel(report.currentRange.endDate)}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="w-fit bg-muted/50">
                  {report.propertyLabel}
                </Badge>
                <Badge variant="outline" className="w-fit bg-muted/50">
                  Generated {new Date(report.generatedAt).toLocaleString("en-GB")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {report.propertySource === "legacy" ? (
              <p className="mb-3 text-sm text-muted-foreground">
                This summary is designed as a concise, client-ready snapshot for
                presentations, proposals and sales conversations.
              </p>
            ) : null}
            <div className="grid gap-2 text-sm text-muted-foreground">
              {narrative.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isSectionVisible("summary") ? (
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
      ) : null}

      {isSectionVisible("trend") || isSectionVisible("sources") ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          {isSectionVisible("trend") ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Audience Reach Trend</CardTitle>
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
          ) : null}

          {isSectionVisible("sources") ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Audience Acquisition</CardTitle>
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
          ) : null}
        </div>
      ) : null}

      {isSectionVisible("snapshot") || isSectionVisible("devices") ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {isSectionVisible("snapshot") ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Engagement Snapshot</CardTitle>
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
                  <div className="rounded-xl border bg-muted/20 p-4">
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
          ) : null}

          {isSectionVisible("devices") ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Device Profile</CardTitle>
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
          ) : null}
        </div>
      ) : null}

      {isSectionVisible("highlights") ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Content Performance</CardTitle>
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
      ) : null}

      {isSectionVisible("top-pages") ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Page Performance</CardTitle>
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
      ) : null}

      {isSectionVisible("social-summary") ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Social Reach Summary</CardTitle>
            <CardDescription>
              Connected Meta channels for the same reporting window as the web report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {socialErrorMessage ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                {socialErrorMessage}
              </div>
            ) : null}

            {socialReport ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <MetricCard
                    label="Connected Channels"
                    value={formatInteger(connectedSocialChannels.length)}
                    supporting="Social profiles currently linked to the report"
                  />
                  <MetricCard
                    label="Followers"
                    value={formatInteger(totalSocialFollowers)}
                    supporting="Combined followers across connected social profiles"
                  />
                  <MetricCard
                    label="Recent Engagements"
                    value={formatInteger(totalSocialEngagements)}
                    supporting="Combined interaction totals currently available from connected social APIs"
                  />
                  <MetricCard
                    label="Reach / Impressions"
                    value={formatInteger(totalSocialReach || totalSocialImpressions)}
                    supporting="Latest visibility totals currently available from connected social APIs"
                  />
                  <MetricCard
                    label="Profile Visits"
                    value={formatInteger(totalSocialProfileViews)}
                    supporting="Latest daily profile visits returned by connected social APIs"
                  />
                  <MetricCard
                    label="Accounts Engaged"
                    value={formatInteger(totalSocialAccountsEngaged)}
                    supporting="Latest daily engaged accounts returned by connected social APIs"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {socialReport.channels.map((channel) => (
                    <Card key={channel.platform} className="border-accent/10">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="font-serif text-xl">
                              {channel.label}
                            </CardTitle>
                            <CardDescription>
                              {channel.accountName || "Not connected"}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className="w-fit bg-muted/50"
                          >
                            {channel.connected ? "Connected" : "Setup needed"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {channel.statusMessage ? (
                          <p className="text-sm text-muted-foreground">
                            {channel.statusMessage}
                          </p>
                        ) : null}
                        {channel.insightWindowLabel ? (
                          <p className="text-xs text-muted-foreground">
                            {channel.insightWindowLabel}
                          </p>
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="text-sm font-medium text-muted-foreground">
                              Followers
                            </div>
                            <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                              {formatInteger(channel.followers)}
                            </div>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="text-sm font-medium text-muted-foreground">
                              Total interactions
                            </div>
                            <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                              {formatInteger(channel.engagements)}
                            </div>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="text-sm font-medium text-muted-foreground">
                              Content library
                            </div>
                            <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                              {formatInteger(channel.contentCount)}
                            </div>
                          </div>
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="text-sm font-medium text-muted-foreground">
                              Reach / impressions
                            </div>
                            <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                              {formatInteger(channel.reach ?? channel.impressions)}
                            </div>
                          </div>
                          {channel.platform === "instagram" ? (
                            <>
                              <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="text-sm font-medium text-muted-foreground">
                                  Profile visits
                                </div>
                                <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                                  {formatInteger(channel.profileViews ?? 0)}
                                </div>
                              </div>
                              <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="text-sm font-medium text-muted-foreground">
                                  Accounts engaged
                                </div>
                                <div className="mt-2 font-serif text-3xl font-bold text-foreground">
                                  {formatInteger(channel.accountsEngaged ?? 0)}
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>

                        {channel.profileUrl ? (
                          <div className="text-sm text-muted-foreground">
                            Profile:{" "}
                            <a
                              href={channel.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-foreground underline underline-offset-4"
                            >
                              {channel.accountHandle || channel.accountName || channel.profileUrl}
                            </a>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Add Meta API credentials to load Facebook and Instagram stats into
                this report.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isSectionVisible("social-content") ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Social Content Highlights</CardTitle>
            <CardDescription>
              Highest-engagement recent items from connected Facebook and Instagram profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {socialReport && socialReport.topContent.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Engagements</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {socialReport.topContent.map((item) => (
                    <TableRow key={`${item.platform}-${item.id}`}>
                      <TableCell className="font-medium capitalize">
                        {item.platform}
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTimeLabel(item.publishedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatInteger(item.engagements)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatInteger(item.likes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatInteger(item.comments)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatInteger(item.impressions)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Connect the Meta API to start pulling Facebook and Instagram content
                performance into this section.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
