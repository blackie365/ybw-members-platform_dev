import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_API_BASE = "https://analyticsdata.googleapis.com/v1beta";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

let accessTokenCache:
  | {
      token: string;
      expiresAt: number;
    }
  | null = null;

export type WebStatsRange = "30d" | "90d" | "365d";
export type WebStatsSelection = WebStatsRange | "custom";
export type Ga4PropertySource = "current" | "legacy";

export interface Ga4SummaryMetrics {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  engagementRate: number;
  averageSessionDuration: number;
}

export interface Ga4TrendPoint {
  date: string;
  label: string;
  users: number;
  sessions: number;
  pageViews: number;
}

export interface Ga4ChannelPoint {
  channel: string;
  sessions: number;
  users: number;
}

export interface Ga4DevicePoint {
  device: string;
  sessions: number;
  users: number;
}

export interface Ga4CountryPoint {
  country: string;
  users: number;
}

export interface Ga4PagePoint {
  title: string;
  path: string;
  pageViews: number;
  users: number;
}

export interface Ga4WebStatsReport {
  range: WebStatsSelection;
  rangeLabel: string;
  propertySource: Ga4PropertySource;
  propertyLabel: string;
  currentRange: {
    startDate: string;
    endDate: string;
  };
  previousRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    current: Ga4SummaryMetrics;
    previous: Ga4SummaryMetrics;
  };
  trend: Ga4TrendPoint[];
  channels: Ga4ChannelPoint[];
  devices: Ga4DevicePoint[];
  countries: Ga4CountryPoint[];
  topPages: Ga4PagePoint[];
  generatedAt: string;
}

interface Ga4ReportRow {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

interface Ga4RunReportResponse {
  rows?: Ga4ReportRow[];
}

interface DateRangeWindow {
  startDate: string;
  endDate: string;
}

const RANGE_LABELS: Record<WebStatsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
};

export interface Ga4DateRangeOptions {
  range?: WebStatsRange;
  startDate?: string;
  endDate?: string;
  propertySource?: Ga4PropertySource;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function base64UrlEncode(input: Buffer | string) {
  const value = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signJwt(unsignedToken: string, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  return base64UrlEncode(signer.sign(privateKey));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Custom date range must use YYYY-MM-DD format.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || formatDate(parsed) !== value) {
    throw new Error("Custom date range contains an invalid date.");
  }

  return parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getRangeDays(range: WebStatsRange) {
  switch (range) {
    case "90d":
      return 90;
    case "365d":
      return 365;
    case "30d":
    default:
      return 30;
  }
}

function getDaySpan(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function buildCustomWindows(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);

  if (start.getTime() > end.getTime()) {
    throw new Error("Custom start date must be before the end date.");
  }

  const totalDays = getDaySpan(startDate, endDate);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(totalDays - 1));

  return {
    selection: "custom" as const,
    rangeLabel: "Custom period",
    totalDays,
    current: {
      startDate,
      endDate,
    },
    previous: {
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd),
    },
  };
}

function getDateWindows(options: Ga4DateRangeOptions = {}) {
  if (options.startDate && options.endDate) {
    return buildCustomWindows(options.startDate, options.endDate);
  }

  const range = options.range ?? "30d";
  const totalDays = getRangeDays(range);
  const end = addDays(new Date(), -1);
  const start = addDays(end, -(totalDays - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(totalDays - 1));

  return {
    selection: range,
    rangeLabel: RANGE_LABELS[range],
    totalDays,
    current: {
      startDate: formatDate(start),
      endDate: formatDate(end),
    },
    previous: {
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd),
    },
  };
}

async function getAccessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: GA4_SCOPE,
    aud: TOKEN_URL,
    exp: expiresAt,
    iat: issuedAt,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const assertion = `${unsignedToken}.${signJwt(unsignedToken, privateKey)}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to obtain GA4 access token: ${details}`);
  }

  const payloadJson = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  accessTokenCache = {
    token: payloadJson.access_token,
    expiresAt: Date.now() + payloadJson.expires_in * 1000,
  };

  return payloadJson.access_token;
}

function getPropertyConfig(propertySource: Ga4PropertySource) {
  const currentPropertyId =
    process.env.GA4_PROPERTY_ID_CURRENT || process.env.GA4_PROPERTY_ID;
  const legacyPropertyId =
    process.env.GA4_PROPERTY_ID_LEGACY || process.env.GA4_PROPERTY_ID;

  if (propertySource === "legacy") {
    if (!legacyPropertyId) {
      throw new Error(
        "Missing required environment variable: GA4_PROPERTY_ID_LEGACY",
      );
    }

    return {
      propertyId: legacyPropertyId,
      propertyLabel: "Legacy snapshot",
    };
  }

  if (!currentPropertyId) {
    throw new Error(
      "Missing required environment variable: GA4_PROPERTY_ID_CURRENT",
    );
  }

  return {
    propertyId: currentPropertyId,
    propertyLabel: "Current property",
  };
}

async function runReport(
  body: Record<string, unknown>,
  propertySource: Ga4PropertySource,
): Promise<Ga4RunReportResponse> {
  const { propertyId } = getPropertyConfig(propertySource);
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${GA4_API_BASE}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to fetch GA4 report: ${details}`);
  }

  return (await response.json()) as Ga4RunReportResponse;
}

function parseMetricNumber(value?: string) {
  return value ? Number(value) : 0;
}

function getSummaryMetrics(rows?: Ga4ReportRow[]): Ga4SummaryMetrics {
  const row = rows?.[0];
  return {
    totalUsers: parseMetricNumber(row?.metricValues?.[0]?.value),
    newUsers: parseMetricNumber(row?.metricValues?.[1]?.value),
    sessions: parseMetricNumber(row?.metricValues?.[2]?.value),
    pageViews: parseMetricNumber(row?.metricValues?.[3]?.value),
    engagementRate: parseMetricNumber(row?.metricValues?.[4]?.value),
    averageSessionDuration: parseMetricNumber(row?.metricValues?.[5]?.value),
  };
}

function getMonthDayLabel(dateValue?: string) {
  if (!dateValue || dateValue.length !== 8) return "";
  const year = Number(dateValue.slice(0, 4));
  const month = Number(dateValue.slice(4, 6)) - 1;
  const day = Number(dateValue.slice(6, 8));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month, day)));
}

function mapTrendRows(rows?: Ga4ReportRow[]): Ga4TrendPoint[] {
  return (rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    label: getMonthDayLabel(row.dimensionValues?.[0]?.value),
    users: parseMetricNumber(row.metricValues?.[0]?.value),
    sessions: parseMetricNumber(row.metricValues?.[1]?.value),
    pageViews: parseMetricNumber(row.metricValues?.[2]?.value),
  }));
}

function mapChannelRows(rows?: Ga4ReportRow[]): Ga4ChannelPoint[] {
  return (rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || "Unassigned",
    sessions: parseMetricNumber(row.metricValues?.[0]?.value),
    users: parseMetricNumber(row.metricValues?.[1]?.value),
  }));
}

function mapDeviceRows(rows?: Ga4ReportRow[]): Ga4DevicePoint[] {
  return (rows ?? []).map((row) => ({
    device: row.dimensionValues?.[0]?.value || "Unknown",
    sessions: parseMetricNumber(row.metricValues?.[0]?.value),
    users: parseMetricNumber(row.metricValues?.[1]?.value),
  }));
}

function mapCountryRows(rows?: Ga4ReportRow[]): Ga4CountryPoint[] {
  return (rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || "Unknown",
    users: parseMetricNumber(row.metricValues?.[0]?.value),
  }));
}

function mapPageRows(rows?: Ga4ReportRow[]): Ga4PagePoint[] {
  return (rows ?? []).map((row) => ({
    title: row.dimensionValues?.[0]?.value || "Untitled page",
    path: row.dimensionValues?.[1]?.value || "/",
    pageViews: parseMetricNumber(row.metricValues?.[0]?.value),
    users: parseMetricNumber(row.metricValues?.[1]?.value),
  }));
}

function buildDateRangeWindow(window: DateRangeWindow) {
  return [{ startDate: window.startDate, endDate: window.endDate }];
}

export async function getGa4WebStatsReport(
  options: Ga4DateRangeOptions = {},
): Promise<Ga4WebStatsReport> {
  const windows = getDateWindows(options);
  const propertySource = options.propertySource ?? "current";
  const propertyConfig = getPropertyConfig(propertySource);

  const [
    currentSummary,
    previousSummary,
    trendReport,
    channelsReport,
    devicesReport,
    countriesReport,
    topPagesReport,
  ] = await Promise.all([
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
      ],
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.previous),
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
      ],
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      keepEmptyRows: true,
      limit: windows.totalDays.toString(),
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "6",
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "6",
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      dimensions: [{ name: "country" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: "5",
    }, propertySource),
    runReport({
      dateRanges: buildDateRangeWindow(windows.current),
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "10",
    }, propertySource),
  ]);

  return {
    range: windows.selection,
    rangeLabel: windows.rangeLabel,
    propertySource,
    propertyLabel: propertyConfig.propertyLabel,
    currentRange: windows.current,
    previousRange: windows.previous,
    summary: {
      current: getSummaryMetrics(currentSummary.rows),
      previous: getSummaryMetrics(previousSummary.rows),
    },
    trend: mapTrendRows(trendReport.rows),
    channels: mapChannelRows(channelsReport.rows),
    devices: mapDeviceRows(devicesReport.rows),
    countries: mapCountryRows(countriesReport.rows),
    topPages: mapPageRows(topPagesReport.rows),
    generatedAt: new Date().toISOString(),
  };
}
