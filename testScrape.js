const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function test() {
  const res = await fetch('https://www.bbc.com/news/articles/c8r40n1ml7do');
  const html = await res.text();
  const $ = cheerio.load(html);
  let text = '';
  $('article p, main p').each((_, el) => {
    text += $(el).text() + '\n\n';
  });
  console.log(text.substring(0, 500));
}
test();
