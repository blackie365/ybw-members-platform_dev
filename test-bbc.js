console.log("Starting test...");
async function test() {
  console.log("Inside test...");
  try {
    const res = await fetch('https://www.bbc.com/news/articles/ckgwde1z9x7o');
    console.log("Fetch done...");
    const html = await res.text();
    console.log("HTML length:", html.length);
  } catch (err) {
    console.error("Error:", err);
  }
}
test().then(() => console.log("Test finished"));
