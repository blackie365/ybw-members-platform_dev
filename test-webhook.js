const fetch = require('node-fetch'); // Using standard fetch in Node 18+

async function testWebhook() {
  const secret = 'my-super-secret-purge-key-123';
  const url = `http://localhost:3000/api/revalidate/ghost?secret=${secret}`;

  console.log(`Testing webhook at: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post: {
          current: { title: "Test Post" }
        }
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testWebhook();