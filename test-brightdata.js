// Test script to run BrightData YouTube Fetch manually
const fs = require('fs');

async function testFetch() {
  const apiKey = '0b8d368b-6db3-4a5e-8d7c-a74850dd1b69';
  const zone = 'residential_proxy1';
  const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCoMdktPbSTixAyNGWB-UYkQ';

  try {
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: zone,
        url: url,
        format: 'raw'
      })
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response Length:', text.length);
    console.log('First 200 chars:', text.slice(0, 200));
  } catch (err) {
    console.error('Error:', err);
  }
}

testFetch();