const META_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const RECENT_ITEM_LIMIT = 5;

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

function getMetaEnv() {
  return {
    accessToken: process.env.META_ACCESS_TOKEN,
    facebookPageId: process.env.META_FACEBOOK_PAGE_ID,
    instagramBusinessAccountId: process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID,
  };
}

async function fetchMeta<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const { accessToken } = getMetaEnv();
  if (!accessToken) {
    throw new Error("Missing required environment variable: META_ACCESS_TOKEN");
  }

  const searchParams = new URLSearchParams();
  searchParams.set("access_token", accessToken);

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
    throw new Error(`Meta API request failed: ${details}`);
  }

  return (await response.json()) as T;
}

function getInsightValue(insights: MetaInsightItem[] | undefined, metricName: string) {
  const insight = insights?.find((item) => item.name === metricName);
  const value = insight?.values?.[0]?.value;
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
    const [page, posts] = await Promise.all([
      fetchMeta<FacebookPageResponse>(`/${facebookPageId}`, {
        fields: "name,link,fan_count,followers_count,instagram_business_account{id}",
      }),
      fetchMeta<MetaListResponse<FacebookPostItem>>(`/${facebookPageId}/published_posts`, {
        fields:
          "id,message,permalink_url,created_time,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),insights.metric(post_impressions,post_engaged_users)",
        since: startDate,
        until: endDate,
        limit: RECENT_ITEM_LIMIT,
      }),
    ]);

    const content = (posts.data ?? []).map((post) => {
      const likes = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const engagements = getInsightValue(post.insights?.data, "post_engaged_users");
      const impressions = getInsightValue(post.insights?.data, "post_impressions");

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
      },
      content,
      instagramBusinessAccountId:
        page.instagram_business_account?.id || undefined,
    };
  } catch (error) {
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
  const { instagramBusinessAccountId } = getMetaEnv();
  const accountId =
    instagramBusinessAccountId || options.derivedInstagramBusinessAccountId;

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

  try {
    const [profile, media] = await Promise.all([
      fetchMeta<InstagramProfileResponse>(`/${accountId}`, {
        fields: "username,followers_count,media_count",
      }),
      fetchMeta<MetaListResponse<InstagramMediaItem>>(`/${accountId}/media`, {
        fields:
          "id,caption,permalink,timestamp,like_count,comments_count",
        since: options.startDate,
        until: options.endDate,
        limit: RECENT_ITEM_LIMIT,
      }),
    ]);

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
        engagements: content.reduce((sum, item) => sum + item.engagements, 0),
        impressions: 0,
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
  const { accessToken } = getMetaEnv();
  if (!accessToken) {
    return {
      channels: [
        createDisconnectedChannel(
          "facebook",
          "Facebook",
          "Add META_ACCESS_TOKEN and META_FACEBOOK_PAGE_ID to enable Meta reporting.",
        ),
        createDisconnectedChannel(
          "instagram",
          "Instagram",
          "Add META_ACCESS_TOKEN and connect an Instagram business account to enable reporting.",
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
