const url = 'https://yorkshirebusinesswoman.co.uk/ghost/api/content/posts/?key=61f6041a1f00410f9ac05a60a4&limit=3&filter=tag:events&include=tags';
fetch(url, { headers: { 'Accept-Version': 'v5.0' } })
  .then(res => res.json())
  .then(data => console.log(data.posts.map(p => p.title)))
  .catch(console.error);
