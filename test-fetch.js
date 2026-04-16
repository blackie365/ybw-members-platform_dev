const url = 'https://yorkshirebusinesswoman.co.uk/ghost/api/content/posts/?key=61f6041a1f00410f9ac05a60a4&limit=100&include=tags,authors';
fetch(url, { headers: { 'Accept-Version': 'v5.0' } })
  .then(res => res.json())
  .then(data => console.log(data.posts.length))
  .catch(console.error);
