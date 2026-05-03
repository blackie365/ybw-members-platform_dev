export interface VideoArticle {
  id: string;
  title: string;
  link: string;
  published_at: string;
  thumbnail: string;
  channelName: string;
  videoId: string;
}

export async function getVideoNews(channelId: string, limit = 4): Promise<VideoArticle[]> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.warn('YOUTUBE_API_KEY is not configured. Returning empty video list.');
      return [];
    }

    // Official YouTube Data API v3 Endpoint for fetching recent videos from a channel
    const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${limit}&type=video`;

    const res = await fetch(url, {
      next: { revalidate: 3600 } // Cache for 1 hour to stay well within free quota limits
    });

    if (!res.ok) {
      console.warn(`YouTube API request failed (Status: ${res.status}). Ensure your API key is valid and has the YouTube Data API v3 enabled.`);
      return [];
    }

    const data = await res.json();

    if (!data.items || !Array.isArray(data.items)) {
      console.warn('Unexpected response format from YouTube API:', data);
      return [];
    }

    const videos: VideoArticle[] = data.items.map((item: any) => {
      const videoId = item.id?.videoId || '';
      
      // Get highest quality thumbnail available
      const snippet = item.snippet || {};
      const thumbnails = snippet.thumbnails || {};
      const thumbnail = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        id: videoId,
        title: snippet.title || 'Untitled Video',
        link: `https://www.youtube.com/watch?v=${videoId}`,
        published_at: snippet.publishedAt || new Date().toISOString(),
        thumbnail,
        channelName: snippet.channelTitle || 'YouTube Channel',
        videoId: videoId
      };
    });

    return videos.filter(v => v.videoId); // Only return valid videos
  } catch (error) {
    console.error(`Error fetching video news for channel ${channelId} via YouTube API:`, error);
    return [];
  }
}
