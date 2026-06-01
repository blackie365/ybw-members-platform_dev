import IssuuSDK from '@issuu/issuu-api-sdk';

/**
 * ISSUU SERVICE
 * 
 * This service handles communication with the Issuu API to fetch
 * publication data and page assets for the digital reader.
 */

const ISSUU_TOKEN = process.env.ISSUU_API_TOKEN;

const issuu = ISSUU_TOKEN ? IssuuSDK(ISSUU_TOKEN) : null;

export interface IssuuPageAsset {
  pageNumber: number;
  url: string;
}

export const issuuService = {
  /**
   * Fetches all page images for a specific publication
   * @param slug The Issuu publication slug (e.g., 'ybw_april-may_2026')
   */
  async getPublicationPages(slug: string): Promise<IssuuPageAsset[]> {
    if (!issuu) {
      console.warn('Issuu API Token is missing. Please add ISSUU_API_TOKEN to your environment variables.');
      return [];
    }

    try {
      const response = await issuu.publication.getPublicationAssetsBySlug(slug, 'page', 100);
      
      if (response && Array.isArray(response.items)) {
        return response.items.map((item: any) => ({
          pageNumber: item.documentPageNumber,
          url: item.url
        })).sort((a: any, b: any) => a.pageNumber - b.pageNumber);
      }

      return [];
    } catch (error) {
      console.error(`Error fetching Issuu assets for ${slug}:`, error);
      return [];
    }
  },

  /**
   * Fetches metadata for a publication
   */
  async getPublicationMetadata(slug: string) {
    if (!issuu) return null;
    try {
      return await issuu.publication.getPublicationBySlug(slug);
    } catch (error) {
      console.error(`Error fetching Issuu metadata for ${slug}:`, error);
      return null;
    }
  },

  /**
   * Fetches a list of published publications from Issuu
   */
  async listPublications(page = 1, size = 10) {
    if (!issuu) return [];
    try {
      const response = await issuu.user.getMyPublications('', 'PUBLISHED', page, size);
      if (response && Array.isArray(response.items)) {
        return response.items;
      }
      return [];
    } catch (error) {
      console.error('Error listing Issuu publications:', error);
      return [];
    }
  }
};
