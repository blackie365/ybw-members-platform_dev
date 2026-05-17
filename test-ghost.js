const fetch = require('node-fetch');

async function test() {
  const url = 'https://admin.yorkshirebusinesswoman.co.uk/ghost/api/content/posts/?key=61f6041a1f00410f9ac05a60a4&filter=tag:events&limit=1&include=tags';
  const res = await fetch(url, { headers: { 'Accept-Version': 'v5.0' } });
  const data = await res.json();
  console.log(JSON.stringify(data.posts[0], null, 2));
}

test();
