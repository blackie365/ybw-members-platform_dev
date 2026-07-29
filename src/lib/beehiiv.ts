/**
 * Beehiiv API Library
 * 
 * Handles subscriber management and automation with Beehiiv.
 */

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

export function isBeehiivConfigured(): boolean {
  return Boolean(BEEHIIV_API_KEY && BEEHIIV_PUBLICATION_ID);
}

interface AddSubscriberParams {
  email: string;
  reactivate?: boolean;
  sendWelcomeEmail?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referringSite?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface BeehiivSubscriberResult {
  success: boolean;
  alreadyExists?: boolean;
  error?: string;
  httpStatus?: number;
  data?: unknown;
  disabled?: boolean;
}

/**
 * Adds a new subscriber to the Beehiiv publication.
 */
export async function addBeehiivSubscriber({
  email,
  reactivate = true,
  sendWelcomeEmail = true,
  utmSource = 'v0-magazine',
  utmMedium = 'organic',
  utmCampaign = 'newsletter-signup',
  referringSite = 'yorkshirebusinesswoman.co.uk',
  customFields = {}
}: AddSubscriberParams): Promise<BeehiivSubscriberResult> {
  if (!isBeehiivConfigured()) {
    const msg = 'Beehiiv API Key or Publication ID is missing';
    console.warn('[Beehiiv] Disabled / not configured. Skipping sync for:', email);
    return { success: false, disabled: true, error: msg };
  }

  try {
    const response = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`
      },
      body: JSON.stringify({
        email,
        reactivate_existing: reactivate,
        send_welcome_email: sendWelcomeEmail,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referring_site: referringSite,
        custom_fields: Object.entries(customFields).map(([name, value]) => ({ name, value }))
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Beehiiv commonly uses 422 for validation/dupes, but sometimes 409 for
      // existing-subscriber conflicts depending on API version.
      const isConflict = response.status === 409 || response.status === 422;
      const combinedMsg = [
        data?.errors?.[0]?.message,
        data?.error,
        data?.message,
      ].filter(Boolean).join(' ');
      const combinedLower = combinedMsg.toLowerCase();
      if (
        isConflict &&
        (combinedLower.includes('already') ||
          combinedLower.includes('duplicate') ||
          combinedLower.includes('taken') ||
          combinedLower.includes('exists'))
      ) {
        console.log('[Beehiiv] Subscriber already exists:', email);
        return { success: true, alreadyExists: true, httpStatus: response.status };
      }

      console.error('[Beehiiv] API Error status=' + response.status, data);
      return {
        success: false,
        error: combinedMsg || `Unexpected API response (HTTP ${response.status})`,
        httpStatus: response.status,
      };
    }

    console.log('[Beehiiv] Successfully added subscriber:', email);
    return { success: true, data: data.data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Beehiiv] Error in addBeehiivSubscriber:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Bulk adds subscribers to Beehiiv (useful for initial migration).
 * Note: Beehiiv v2 API doesn't have a direct bulk endpoint for subscriptions, 
 * so we iterate with a delay to avoid rate limiting.
 */
export async function bulkAddBeehiivSubscribers(subscribers: AddSubscriberParams[]) {
  const results = [];
  for (const sub of subscribers) {
    const result = await addBeehiivSubscriber(sub);
    results.push({ email: sub.email, ...result });
    // Small delay to prevent hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}

/**
 * Removes a subscriber from Beehiiv.
 */
export async function deleteBeehiivSubscriber(email: string) {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
    return { success: false, error: 'API Configuration missing' };
  }

  try {
    const response = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions/by_email/${email}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`
      }
    });

    if (response.status === 204) {
      console.log('Successfully removed subscriber from Beehiiv:', email);
      return { success: true };
    }

    const data = await response.json();
    console.error('Beehiiv API Error:', data);
    return { success: false, error: data.errors?.[0]?.message || 'Failed to remove subscriber' };
  } catch (error: any) {
    console.error('Error in deleteBeehiivSubscriber:', error.message);
    return { success: false, error: error.message };
  }
}
