import { getExternalNews } from './src/lib/externalNews';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const news = await getExternalNews(1);
  console.log("Title:", news[0].title);
  console.log("Excerpt length:", news[0].excerpt.length);
  console.log("Excerpt start:", news[0].excerpt.substring(0, 100));
}
run();
