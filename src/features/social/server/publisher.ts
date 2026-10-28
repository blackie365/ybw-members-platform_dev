import { config } from '@/lib/config';

/**
 * Meta Graph API publisher for approved social posts.
 *
 * Everything here is inert unless SOCIAL_PUBLISH_ENABLED=true, so the queue and
 * approval flow can be exercised on a deploy that only has read-only Meta
 * scopes. Two extra scopes are required on the Page token before this can
 * actually publish:
 *
 *   pages_manage_posts           (Facebook Page photo posts)
 *   instagram_content_publish    (Instagram feed + Story)
 *
 * The Instagram endpoints never accept an upload — they take a publicly
 * reachable `image_url`, which is what /api/social/card/{slug} serves.
 */

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type PublishTarget = 'facebook_page' | 'instagram_feed' | 'instagram_story';

export interface PublishOutcome {
  target: PublishTarget;
  ok: boolean;
  id?: string;
  error?: string;
}

export function publishEnabled(): boolean {
  return process.env.SOCIAL_PUBLISH_ENABLED === 'true';
}

function pageId(): string | undefined {
  return process.env.META_FACEBOOK_PAGE_ID;
}

function instagramId(): string | undefined {
  return process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
}

function pageToken(): string | undefined {
  return process.env.META_FACEBOOK_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
}

function instagramToken(): string | undefined {
  return (
    process.env.META_INSTAGRAM_ACCESS_TOKEN ||
    process.env.META_FACEBOOK_ACCESS_TOKEN ||
    process.env.META_ACCESS_TOKEN
  );
}

async function metaPost<T>(
  path: string,
  params: Record<string, string | undefined>,
  token: string,
): Promise<T> {
  const body = new URLSearchParams();
  body.set('access_token', token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') body.set(key, value);
  }

  const res = await fetch(`${META_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta API ${res.status} ${res.statusText}`);
  }
  return json as T;
}

/**
 * Publicly reachable card URL — the only way Instagram will accept an image.
 * JPEG because Meta's image container requires it and rejects PNG.
 */
export function cardUrl(slug: string, format: 'portrait' | 'whatsapp'): string {
  return `${config.siteUrl.replace(/\/$/, '')}/api/social/card/${encodeURIComponent(slug)}?format=${format}&type=jpeg`;
}

async function postToFacebookPage(slug: string, caption: string): Promise<string> {
  const id = pageId();
  const token = pageToken();
  if (!id || !token) throw new Error('META_FACEBOOK_PAGE_ID / page token not configured');

  const result = await metaPost<{ id?: string; post_id?: string }>(
    `/${id}/photos`,
    { url: cardUrl(slug, 'portrait'), caption, published: 'true' },
    token,
  );
  const postId = result.post_id || result.id;
  if (!postId) throw new Error('Facebook returned no post id');
  return postId;
}

async function postToInstagram(
  slug: string,
  caption: string,
  format: 'portrait' | 'whatsapp',
  mediaType: 'feed' | 'story',
): Promise<string> {
  const id = instagramId();
  const token = instagramToken();
  if (!id || !token) throw new Error('META_INSTAGRAM_BUSINESS_ACCOUNT_ID / token not configured');

  // Step 1: create the media container.
  const container = await metaPost<{ id?: string }>(
    `/${id}/media`,
    {
      image_url: cardUrl(slug, format),
      caption: mediaType === 'story' ? undefined : caption,
      media_type: mediaType === 'story' ? 'STORIES' : undefined,
    },
    token,
  );
  if (!container.id) throw new Error('Instagram returned no container id');

  // Step 2: publish it.
  const published = await metaPost<{ id?: string }>(
    `/${id}/media_publish`,
    { creation_id: container.id },
    token,
  );
  if (!published.id) throw new Error('Instagram returned no published id');
  return published.id;
}

/**
 * Publish an approved article to every configured surface. Each target is
 * attempted independently — one failure does not abort the others.
 */
export async function publishArticle(input: {
  slug: string;
  captionFb: string;
  captionIg: string;
  targets: string[];
}): Promise<PublishOutcome[]> {
  const wanted = input.targets.filter((t): t is PublishTarget =>
    t === 'facebook_page' || t === 'instagram_feed' || t === 'instagram_story',
  );

  const results: PublishOutcome[] = [];
  for (const target of wanted) {
    try {
      const id =
        target === 'facebook_page'
          ? await postToFacebookPage(input.slug, input.captionFb)
          : target === 'instagram_feed'
            ? await postToInstagram(input.slug, input.captionIg, 'portrait', 'feed')
            : await postToInstagram(input.slug, input.captionIg, 'whatsapp', 'story');
      results.push({ target, ok: true, id });
    } catch (error) {
      results.push({
        target,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
