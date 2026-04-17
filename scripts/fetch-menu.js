const fetch = require('node-fetch');

async function getMenu() {
  const res = await fetch('https://yorkshirebusinesswoman.co.uk');
  const html = await res.text();
  
  const ulBlocks = html.match(/<ul[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/ul>/ig);
  if (ulBlocks) {
    ulBlocks.forEach(n => console.log(n));
  } else {
    console.log("No ul.nav found");
  }
}

getMenu().catch(console.error);