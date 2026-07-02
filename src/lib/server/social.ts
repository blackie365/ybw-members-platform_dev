const META_API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const RECENT_ITEM_LIMIT = 5;

// #region debug-point A:meta-debug-bootstrap
const __metaDbg = (() => {
  try {
    const fs = require("fs");
    const p = ".dbg/web-stats-facebook.env";
    let u = "http://127.0.0.1:7777/event";
    let s = "web-stats-facebook";
    try {
      const e = fs.readFileSync(p, "utf8");
      u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u;
      s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s;
    } catch {}
    return (payload: any) => {
      fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s, ...payload, ts: Date.now() }),
      }).catch(() => {});
    };
  } catch {
    return (_payload: any) => {};
  }
})();
// #endregion

export interface SocialDateRangeOptions {
  startDate: string;
  endDate: string;
}

export interface SocialChannelSummary {
  platform: "facebook" | "instagram";
  label: string;
  connected: boolean;
  accountName?: string;
  accountHandle?: string;
  profileUrl?: string;
  followers: number;
  contentCount: number;
  engagements: number;
  impressions: number;
  reach?: number;
  profileViews?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
  insightWindowLabel?: string;
  statusMessage?: string;
}

export interface SocialContentItem {
  id: string;
  platform: "facebook" | "instagram";
  title: string;
  url?: string;
  publishedAt: string;
  engagements: number;
  impressions: number;
  likes: number;
  comments: number;
}

export interface SocialMediaReport {
  channels: SocialChannelSummary[];
  topContent: SocialContentItem[];
  generatedAt: string;
}

interface MetaListResponse<T> {
  data?: T[];
}

interface MetaInsightsValue {
  value?: number | string;
}

interface MetaInsightItem {
  name?: string;
  values?: MetaInsightsValue[];
  total_value?: {
    value?: number | string;
  };
}

interface FacebookPageResponse {
  name?: string;
  link?: string;
  fan_count?: number;
  followers_count?: number;
  instagram_business_account?: {
    id?: string;
  };
}

interface FacebookPostItem {
  id?: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  shares?: {
    count?: number;
  };
  reactions?: {
    summary?: {
      total_count?: number;
    };
  };
  comments?: {
    summary?: {
      total_count?: number;
    };
  };
  insights?: {
    data?: MetaInsightItem[];
  };
}

interface InstagramProfileResponse {
  username?: string;
  followers_count?: number;
  media_count?: number;
}

interface InstagramMediaItem {
  id?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface FacebookPageTokenItem {
  id?: string;
  access_token?: string;
}

function getMetaEnv() {
  return {
    accessToken: process.env.META_ACCESS_TOKEN,
    facebookAccessToken: process.env.META_FACEBOOK_ACCESS_TOKEN,
    instagramAccessToken: process.env.META_INSTAGRAM_ACCESS_TOKEN,
    facebookPageId: process.env.META_FACEBOOK_PAGE_ID,
    instagramBusinessAccountId: process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID,
  };
}

async function fetchMeta<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  accessTokenOverride?: string,
): Promise<T> {
  const { accessToken } = getMetaEnv();
  const token = accessTokenOverride || accessToken;
  // #region debug-point A:fetchMeta-entry
  __metaDbg({
    runId: "pre",
    hypothesisId: "A",
    location: "social.ts:fetchMeta",
    msg: "[DEBUG] Meta fetchMeta called",
    data: {
      metaApiBase: META_API_BASE,
      path,
      paramKeys: Object.keys(params || {}),
      hasToken: Boolean(token),
      tokenSource: accessTokenOverride ? "override" : "env",
    },
  });
  // #endregion
  if (!token) {
    throw new Error("Missing required Meta access token");
  }

  const searchParams = new URLSearchParams();
  searchParams.set("access_token", token);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const response = await fetch(`${META_API_BASE}${path}?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    // #region debug-point B:fetchMeta-error
    __metaDbg({
      runId: "pre",
      hypothesisId: "B",
      location: "social.ts:fetchMeta",
      msg: "[DEBUG] Meta fetchMeta non-200 response",
      data: {
        path,
        status: response.status,
        statusText: response.statusText,
        detailsPreview: String(details || "").slice(0, 240),
        detailsLength: String(details || "").length,
      },
    });
    // #endregion
    throw new Error(`Meta API request failed: ${details}`);
  }

  // #region debug-point A:fetchMeta-ok
  __metaDbg({
    runId: "pre",
    hypothesisId: "A",
    location: "social.ts:fetchMeta",
    msg: "[DEBUG] Meta fetchMeta ok",
    data: {
      path,
      status: response.status,
    },
  });
  // #endregion
  return (await response.json()) as T;
}

async function resolveFacebookPageAccessToken() {
  const { facebookAccessToken, accessToken, facebookPageId } = getMetaEnv();

  if (facebookAccessToken) {
    // #region debug-point A:fb-token-direct
    __metaDbg({
      runId: "pre",
      hypothesisId: "A",
      location: "social.ts:resolveFacebookPageAccessToken",
      msg: "[DEBUG] Using META_FACEBOOK_ACCESS_TOKEN directly",
      data: { hasFacebookPageId: Boolean(facebookPageId) },
    });
    // #endregion
    return facebookAccessToken;
  }

  if (!accessToken) {
    // #region debug-point D:fb-token-missing
    __metaDbg({
      runId: "pre",
      hypothesisId: "D",
      location: "social.ts:resolveFacebookPageAccessToken",
      msg: "[DEBUG] Missing META_ACCESS_TOKEN for /me/accounts token derivation",
      data: { hasFacebookPageId: Boolean(facebookPageId) },
    });
    // #endregion
    throw new Error(
      "Missing META_FACEBOOK_ACCESS_TOKEN or META_ACCESS_TOKEN to load Facebook page stats.",
    );
  }

  if (!facebookPageId) {
    // #region debug-point D:fb-pageid-missing
    __metaDbg({
      runId: "pre",
      hypothesisId: "D",
      location: "social.ts:resolveFacebookPageAccessToken",
      msg: "[DEBUG] Missing META_FACEBOOK_PAGE_ID",
      data: { hasAccessToken: Boolean(accessToken) },
    });
    // #endregion
    throw new Error("Missing META_FACEBOOK_PAGE_ID to load Facebook page stats.");
  }

  const accounts = await fetchMeta<MetaListResponse<FacebookPageTokenItem>>(
    "/me/accounts",
    {
      fields: "id,access_token",
      limit: 100,
    },
    accessToken,
  );

  // #region debug-point B:fb-accounts-list
  __metaDbg({
    runId: "pre",
    hypothesisId: "B",
    location: "social.ts:resolveFacebookPageAccessToken",
    msg: "[DEBUG] Fetched /me/accounts for page token derivation",
    data: {
      facebookPageId,
      returnedCount: Array.isArray(accounts.data) ? accounts.data.length : 0,
      hasMatchingPage: Boolean(accounts.data?.find((page) => page.id === facebookPageId)),
    },
  });
  // #endregion

  const matchingPage = accounts.data?.find((page) => page.id === facebookPageId);
  if (!matchingPage?.access_token) {
    throw new Error(
      "Unable to derive a Facebook page access token. Add META_FACEBOOK_ACCESS_TOKEN or ensure META_ACCESS_TOKEN is a user token with pages_show_list access to the target page.",
    );
  }

  return matchingPage.access_token;
}

function getInsightValue(insights: MetaInsightItem[] | undefined, metricName: string) {
  const insight = insights?.find((item) => item.name === metricName);
  const value = insight?.values?.[0]?.value;
  return typeof value === "number" ? value : Number(value || 0);
}

function getLatestInsightValue(
  insights: MetaInsightItem[] | undefined,
  metricName: string,
) {
  const insight = insights?.find((item) => item.name === metricName);
  const value = insight?.values?.at(-1)?.value;
  return typeof value === "number" ? value : Number(value || 0);
}

function getTotalInsightValue(
  insights: MetaInsightItem[] | undefined,
  metricName: string,
) {
  const insight = insights?.find((item) => item.name === metricName);
  const value = insight?.total_value?.value;
  return typeof value === "number" ? value : Number(value || 0);
}

function buildContentTitle(value: string | undefined, fallback: string) {
  const firstLine = value?.split("\n").find((line) => line.trim().length > 0)?.trim();
  if (!firstLine) {
    return fallback;
  }

  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function createDisconnectedChannel(
  platform: "facebook" | "instagram",
  label: string,
  statusMessage: string,
): SocialChannelSummary {
  return {
    platform,
    label,
    connected: false,
    followers: 0,
    contentCount: 0,
    engagements: 0,
    impressions: 0,
    statusMessage,
  };
}

async function getFacebookReport({
  startDate,
  endDate,
}: SocialDateRangeOptions): Promise<{
  channel: SocialChannelSummary;
  content: SocialContentItem[];
  instagramBusinessAccountId?: string;
}> {
  const { facebookPageId } = getMetaEnv();
  // #region debug-point A:fb-report-entry
  __metaDbg({
    runId: "pre",
    hypothesisId: "A",
    location: "social.ts:getFacebookReport",
    msg: "[DEBUG] Facebook report requested",
    data: { hasFacebookPageId: Boolean(facebookPageId), startDate, endDate },
  });
  // #endregion
  if (!facebookPageId) {
    return {
      channel: createDisconnectedChannel(
        "facebook",
        "Facebook",
        "Add META_FACEBOOK_PAGE_ID to load Facebook page stats.",
      ),
      content: [],
    };
  }

  try {
    const facebookToken = await resolveFacebookPageAccessToken();
    // #region debug-point A:fb-token-resolved
    __metaDbg({
      runId: "pre",
      hypothesisId: "A",
      location: "social.ts:getFacebookReport",
      msg: "[DEBUG] Facebook page access token resolved",
      data: { facebookPageId, hasToken: Boolean(facebookToken) },
    });
    // #endregion
    const [page, posts] = await Promise.all([
      fetchMeta<FacebookPageResponse>(`/${facebookPageId}`, {
        fields: "name,link,fan_count,followers_count,instagram_business_account{id}",
      }, facebookToken),
      fetchMeta<MetaListResponse<FacebookPostItem>>(`/${facebookPageId}/published_posts`, {
        fields:
          "id,message,permalink_url,created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
        since: startDate,
        until: endDate,
        limit: RECENT_ITEM_LIMIT,
      }, facebookToken),
    ]);

    let insightStatusMessage: string | undefined;
    const postInsights = await Promise.all(
      (posts.data ?? []).map(async (post) => {
        if (!post.id) return { postId: "", impressions: 0 };
        try {
          const insights = await fetchMeta<MetaListResponse<MetaInsightItem>>(
            `/${post.id}/insights`,
            {
              metric: "post_impressions",
              period: "lifetime",
            },
            facebookToken,
          );
          return {
            postId: post.id,
            impressions: getInsightValue(insights.data, "post_impressions"),
          };
        } catch (error) {
          insightStatusMessage =
            error instanceof Error
              ? `Facebook post impressions unavailable: ${error.message}`
              : "Facebook post insights are currently unavailable.";
          return { postId: post.id, impressions: 0 };
        }
      }),
    );
    const insightByPostId = new Map(
      postInsights.filter((row) => row.postId).map((row) => [row.postId, row]),
    );

    // #region debug-point A:fb-fetch-summary
    __metaDbg({
      runId: "pre",
      hypothesisId: "A",
      location: "social.ts:getFacebookReport",
      msg: "[DEBUG] Facebook page/posts fetched",
      data: {
        pageName: page?.name || null,
        hasLink: Boolean(page?.link),
        followerCount: page?.followers_count ?? page?.fan_count ?? null,
        postsReturned: Array.isArray(posts?.data) ? posts.data.length : 0,
        derivedIgId: page?.instagram_business_account?.id || null,
      },
    });
    // #endregion

    const content = (posts.data ?? []).map((post) => {
      const shares = post.shares?.count ?? 0;
      const likes = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const insight = post.id ? insightByPostId.get(post.id) : undefined;
      const engagements = likes + comments + shares;
      const impressions = insight?.impressions ?? 0;

      return {
        id: post.id || `facebook-${Math.random().toString(36).slice(2)}`,
        platform: "facebook" as const,
        title: buildContentTitle(post.message, "Facebook post"),
        url: post.permalink_url,
        publishedAt: post.created_time || new Date().toISOString(),
        engagements,
        impressions,
        likes,
        comments,
      };
    });

    return {
      channel: {
        platform: "facebook",
        label: "Facebook",
        connected: true,
        accountName: page.name || "Facebook Page",
        profileUrl: page.link,
        followers: page.followers_count || page.fan_count || 0,
        contentCount: content.length,
        engagements: content.reduce((sum, item) => sum + item.engagements, 0),
        impressions: content.reduce((sum, item) => sum + item.impressions, 0),
        statusMessage: insightStatusMessage,
      },
      content,
      instagramBusinessAccountId:
        page.instagram_business_account?.id || undefined,
    };
  } catch (error) {
    // #region debug-point B:fb-report-error
    __metaDbg({
      runId: "pre",
      hypothesisId: "B",
      location: "social.ts:getFacebookReport",
      msg: "[DEBUG] Facebook report failed",
      data: {
        facebookPageId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // #endregion
    return {
      channel: createDisconnectedChannel(
        "facebook",
        "Facebook",
        error instanceof Error ? error.message : "Unable to load Facebook stats.",
      ),
      content: [],
    };
  }
}

async function getInstagramReport(
  options: SocialDateRangeOptions & { derivedInstagramBusinessAccountId?: string },
): Promise<{
  channel: SocialChannelSummary;
  content: SocialContentItem[];
}> {
  const { instagramBusinessAccountId, instagramAccessToken, accessToken } = getMetaEnv();
  const accountId =
    instagramBusinessAccountId || options.derivedInstagramBusinessAccountId;
  const instagramToken = instagramAccessToken || accessToken;

  if (!accountId) {
    return {
      channel: createDisconnectedChannel(
        "instagram",
        "Instagram",
        "Add META_INSTAGRAM_BUSINESS_ACCOUNT_ID or connect Instagram to the Facebook page.",
      ),
      content: [],
    };
  }

  if (!instagramToken) {
    return {
      channel: createDisconnectedChannel(
        "instagram",
        "Instagram",
        "Add META_INSTAGRAM_ACCESS_TOKEN or META_ACCESS_TOKEN to load Instagram stats.",
      ),
      content: [],
    };
  }

  try {
    const [profile, media] = await Promise.all([
      fetchMeta<InstagramProfileResponse>(`/${accountId}`, {
        fields: "username,followers_count,media_count",
      }, instagramToken),
      fetchMeta<MetaListResponse<InstagramMediaItem>>(`/${accountId}/media`, {
        fields:
          "id,caption,permalink,timestamp,like_count,comments_count",
        since: options.startDate,
        until: options.endDate,
        limit: RECENT_ITEM_LIMIT,
      }, instagramToken),
    ]);

    let latestReach = 0;
    let profileViews = 0;
    let accountsEngaged = 0;
    let totalInteractions = 0;
    let insightStatusMessage: string | undefined;

    try {
      const [reachInsights, totalValueInsights] = await Promise.all([
        fetchMeta<MetaListResponse<MetaInsightItem>>(`/${accountId}/insights`, {
          metric: "reach",
          period: "day",
        }, instagramToken),
        fetchMeta<MetaListResponse<MetaInsightItem>>(`/${accountId}/insights`, {
          metric: "profile_views,accounts_engaged,total_interactions",
          metric_type: "total_value",
          period: "day",
        }, instagramToken),
      ]);

      latestReach = getLatestInsightValue(reachInsights.data, "reach");
      profileViews = getTotalInsightValue(totalValueInsights.data, "profile_views");
      accountsEngaged = getTotalInsightValue(
        totalValueInsights.data,
        "accounts_engaged",
      );
      totalInteractions = getTotalInsightValue(
        totalValueInsights.data,
        "total_interactions",
      );
    } catch (error) {
      insightStatusMessage =
        error instanceof Error
          ? `Instagram insights unavailable: ${error.message}`
          : "Instagram insights are currently unavailable.";
    }

    const content = (media.data ?? []).map((item) => {
      const likes = item.like_count ?? 0;
      const comments = item.comments_count ?? 0;

      return {
        id: item.id || `instagram-${Math.random().toString(36).slice(2)}`,
        platform: "instagram" as const,
        title: buildContentTitle(item.caption, "Instagram post"),
        url: item.permalink,
        publishedAt: item.timestamp || new Date().toISOString(),
        engagements: likes + comments,
        impressions: 0,
        likes,
        comments,
      };
    });

    return {
      channel: {
        platform: "instagram",
        label: "Instagram",
        connected: true,
        accountName: profile.username ? `@${profile.username}` : "Instagram Account",
        accountHandle: profile.username ? `@${profile.username}` : undefined,
        profileUrl: profile.username
          ? `https://instagram.com/${profile.username}`
          : undefined,
        followers: profile.followers_count ?? 0,
        contentCount: profile.media_count ?? content.length,
        engagements:
          totalInteractions || content.reduce((sum, item) => sum + item.engagements, 0),
        impressions: latestReach,
        reach: latestReach,
        profileViews,
        accountsEngaged,
        totalInteractions,
        insightWindowLabel: "Latest daily Instagram insight snapshot",
        statusMessage: insightStatusMessage,
      },
      content,
    };
  } catch (error) {
    return {
      channel: createDisconnectedChannel(
        "instagram",
        "Instagram",
        error instanceof Error ? error.message : "Unable to load Instagram stats.",
      ),
      content: [],
    };
  }
}

export async function getSocialMediaReport(
  options: SocialDateRangeOptions,
): Promise<SocialMediaReport> {
  const { accessToken, facebookAccessToken, instagramAccessToken } = getMetaEnv();
  // #region debug-point A:social-report-entry
  __metaDbg({
    runId: "pre",
    hypothesisId: "A",
    location: "social.ts:getSocialMediaReport",
    msg: "[DEBUG] Social report requested",
    data: {
      metaApiVersion: META_API_VERSION,
      hasAccessToken: Boolean(accessToken),
      hasFacebookAccessToken: Boolean(facebookAccessToken),
      hasInstagramAccessToken: Boolean(instagramAccessToken),
      hasFacebookPageId: Boolean(getMetaEnv().facebookPageId),
      startDate: options.startDate,
      endDate: options.endDate,
    },
  });
  // #endregion
  if (!accessToken && !facebookAccessToken && !instagramAccessToken) {
    return {
      channels: [
        createDisconnectedChannel(
          "facebook",
          "Facebook",
          "Add META_FACEBOOK_ACCESS_TOKEN or META_ACCESS_TOKEN and META_FACEBOOK_PAGE_ID to enable Meta reporting.",
        ),
        createDisconnectedChannel(
          "instagram",
          "Instagram",
          "Add META_INSTAGRAM_ACCESS_TOKEN or META_ACCESS_TOKEN and connect an Instagram business account to enable reporting.",
        ),
      ],
      topContent: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const facebookReport = await getFacebookReport(options);
  const instagramReport = await getInstagramReport({
    ...options,
    derivedInstagramBusinessAccountId: facebookReport.instagramBusinessAccountId,
  });

  const topContent = [...facebookReport.content, ...instagramReport.content]
    .sort((left, right) => {
      if (right.engagements !== left.engagements) {
        return right.engagements - left.engagements;
      }

      return (
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
      );
    })
    .slice(0, 8);

  return {
    channels: [facebookReport.channel, instagramReport.channel],
    topContent,
    generatedAt: new Date().toISOString(),
  };
}
