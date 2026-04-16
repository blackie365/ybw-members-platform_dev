const GHOST_API_URL = 'https://yorkshirebusinesswoman.co.uk';
const GHOST_CONTENT_API_KEY = '61f6041a1f00410f9ac05a60a4';

async function getTags() {
  const url = new URL(`${GHOST_API_URL}/ghost/api/content/tags/`);
  url.searchParams.append('key', GHOST_CONTENT_API_KEY);
  url.searchParams.append('limit', '4');
  url.searchParams.append('include', 'count.posts');
  url.searchParams.append('order', 'count.posts DESC');
  
  const response = await fetch(url.toString(), {
    headers: { 'Accept-Version': 'v5.0' }
  });
  const data = await response.json();
  console.log(data.tags.map(t => `${t.name} (${t.count?.posts})`));
}
getTags();