// Try a different channel (BBC News instead of Sky News)
const url = `https://www.googleapis.com/youtube/v3/search?key=AIzaSyA6tFXOBM1EUzChEhlnKZDK8ZRleCJwrJY&channelId=UC16niRr50-MSBwiO3YDb3RA&part=snippet,id&order=date&maxResults=3&type=video`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error('Fetch error:', err));