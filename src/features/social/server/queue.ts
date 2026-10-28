import { config } from '@/lib/config';
import { sendEmail } from '@/lib/email';
import {
  fetchPostBySlug,
  fetchRecentPosts,
  renderCardFormats,
  type GhostPost,
} from '@/features/social/server/card-renderer';
import { buildCaptions, type Captions } from '@/features/social/server/captions';
import { getQueuedPostIds, insertQueuedPost } from '@/features/social/server/social-store';
import { approvalLinks } from '@/features/social/server/approval-token';

/**
 * Daily social queue job.
 *
 * Picks the newest Ghost article that has never been queued, renders the card
 * formats, stores a pending row in `social_posts`, and emails the cards plus
 * the proposed captions for one-click approval.
 *
 * Nothing is published here. Publishing happens only when the approval link is
 * clicked (see /api/social/approve), and only when SOCIAL_PUBLISH_ENABLED=true.
 */

const TARGETS = ['facebook_page', 'instagram_feed', 'instagram_story'];

export interface SocialQueueResult {
  queued: boolean;
  dryRun?: boolean;
  id?: number;
  reason?: string;
  article?: { slug: string; title: string; url?: string };
  captions?: Captions;
  cards?: Record<string, { bytes: number }>;
  emailedTo?: string[];
}

export async function runSocialQueue(
  options: { slug?: string; dryRun?: boolean } = {},
): Promise<SocialQueueResult> {
  const post = options.slug ? await fetchPostBySlug(options.slug) : await pickNewestUnqueued();
  if (!post) {
    return { queued: false, reason: 'No new article to queue.' };
  }

  // Ghost's Content API returns its own configured hostname (the admin domain),
  // which must never appear in a public caption — link to the frontend route.
  const publicUrl = `${config.siteUrl.replace(/\/$/, '')}/news/${post.slug}`;
  const article: GhostPost = { ...post, url: publicUrl };

  const captions = buildCaptions(article);
  const cards = await renderCardFormats(post);

  if (options.dryRun) {
    return {
      queued: false,
      dryRun: true,
      article: { slug: post.slug, title: post.title, url: publicUrl },
      captions,
      cards: Object.fromEntries(
        Object.entries(cards).map(([format, buf]) => [format, { bytes: buf.length }]),
      ),
    };
  }

  const row = await insertQueuedPost({
    ghostPostId: post.id,
    slug: post.slug,
    title: post.title,
    url: publicUrl,
    captionFb: captions.fb,
    captionIg: captions.ig,
    targets: TARGETS,
  });

  if (!row) {
    return { queued: false, reason: `Article "${post.slug}" already has a queue row.` };
  }

  const email = await sendApprovalEmail(article, captions, cards, row.id);

  return {
    queued: true,
    id: row.id,
    article: { slug: post.slug, title: post.title, url: publicUrl },
    emailedTo: email.deliveredTo,
  };
}

/** Newest Ghost article with no `social_posts` row, whatever the row's status. */
async function pickNewestUnqueued(): Promise<GhostPost | null> {
  const recent = await fetchRecentPosts(10);
  if (!recent.length) return null;
  const queued = await getQueuedPostIds(recent.map((p) => p.id));
  return recent.find((p) => !queued.has(p.id)) || null;
}

async function sendApprovalEmail(
  post: GhostPost,
  captions: Captions,
  cards: Record<string, Buffer>,
  id: number,
) {
  const links = approvalLinks(id, config.siteUrl);
  const slug = post.slug;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #050505; max-width: 640px; margin: 0 auto;">
      <p style="font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 2px; color: #a3413a; text-transform: uppercase; margin: 0 0 6px;">
        Social queue · #${id}
      </p>
      <h1 style="font-size: 24px; line-height: 1.25; margin: 0 0 10px;">${escapeHtml(post.title)}</h1>
      <p style="font-size: 15px; color: #71717A; margin: 0 0 20px;">
        ${escapeHtml(post.url || `${config.siteUrl}/${slug}`)}
      </p>

      <p style="margin: 0 0 24px;">
        <a href="${links.approve}" style="display:inline-block; background:#050505; color:#FAF9F6; padding:12px 22px; text-decoration:none; font-family: Helvetica, Arial, sans-serif; font-size:14px; margin-right:10px;">Approve &amp; post</a>
        <a href="${links.skip}" style="display:inline-block; border:1px solid #c9956a; color:#050505; padding:12px 22px; text-decoration:none; font-family: Helvetica, Arial, sans-serif; font-size:14px;">Skip</a>
      </p>

      <hr style="border:none; border-top:1px solid #c9956a; margin: 24px 0;" />

      <p style="font-family: Helvetica, Arial, sans-serif; font-size:11px; letter-spacing:1px; color:#71717A; text-transform:uppercase; margin:0 0 6px;">Facebook</p>
      <pre style="font-family: Helvetica, Arial, sans-serif; font-size:14px; white-space:pre-wrap; margin:0 0 20px;">${escapeHtml(captions.fb)}</pre>

      <p style="font-family: Helvetica, Arial, sans-serif; font-size:11px; letter-spacing:1px; color:#71717A; text-transform:uppercase; margin:0 0 6px;">Instagram</p>
      <pre style="font-family: Helvetica, Arial, sans-serif; font-size:14px; white-space:pre-wrap; margin:0 0 20px;">${escapeHtml(captions.ig)}</pre>

      <hr style="border:none; border-top:1px solid #e4e4e7; margin: 24px 0;" />

      <p style="font-family: Helvetica, Arial, sans-serif; font-size:12px; color:#71717A; line-height:1.6;">
        Both card images are attached: the 4:5 one for the Facebook post and
        Instagram feed, the tall 9:16 one for the Instagram Story. Approving
        posts to Facebook Page, Instagram feed and Instagram Story; skipping
        clears the queue entry.
      </p>
    </div>
  `;

  const text = [
    `Social queue #${id}: ${post.title}`,
    post.url || `${config.siteUrl}/${slug}`,
    '',
    `APPROVE: ${links.approve}`,
    `SKIP:    ${links.skip}`,
    '',
    'FACEBOOK',
    captions.fb,
    '',
    'INSTAGRAM',
    captions.ig,
  ].join('\n');

  return sendEmail({
    to: config.adminAlertRecipients,
    subject: `Approve social post: ${post.title}`,
    html,
    text,
    attachments: [
      { filename: `${slug}-feed.png`, content: cards.portrait, contentType: 'image/png' },
      { filename: `${slug}-story.png`, content: cards.whatsapp, contentType: 'image/png' },
    ],
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
