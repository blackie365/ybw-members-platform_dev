const url = 'https://yorkshirebusinesswoman.co.uk/ghost/api/content/tags/?key=61f6041a1f00410f9ac05a60a4&limit=all';
fetch(url, { headers: { 'Accept-Version': 'v5.0' } })
  .then(res => res.json())
  .then(data => console.log(data.tags.map(t => t.slug).slice(0, 20)))
  .catch(console.error);
