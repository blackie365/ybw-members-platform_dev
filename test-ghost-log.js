const GhostContentAPI = require('@tryghost/content-api');
const api = new GhostContentAPI({
  url: 'https://yorkshirebusinesswoman.co.uk',
  key: '61f6041a1f00410f9ac05a60a4',
  version: "v5.0"
});
const axios = require('axios');
const originalGet = axios.get;
axios.get = function() {
  console.log('axios.get', arguments);
  return originalGet.apply(this, arguments);
};
api.posts.browse({ limit: 1 }).then(res => console.log(res.length)).catch(console.error);
