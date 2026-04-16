const GhostContentAPI = require('@tryghost/content-api');
const api = new GhostContentAPI({
  url: 'https://yorkshirebusinesswoman.co.uk',
  key: '61f6041a1f00410f9ac05a60a4',
  version: "v5.0"
});
api.posts.browse({ limit: "all", include: ['tags', 'authors'] })
  .then(res => console.log('count:', res.length, 'meta:', res.meta))
  .catch(console.error);
