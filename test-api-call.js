const fetch = require('node-fetch');

async function run() {
  try {
    const res = await fetch('https://www.yorkshirebusinesswoman.co.uk/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rob@topicuk.co.uk' })
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', text);
  } catch (e) {
    console.log('ERR:', e);
  }
}
run();
