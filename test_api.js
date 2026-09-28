const { api } = require('./.next/server/app/ask/page.js') || {};
// Just simulating the fetch logic
async function test() {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/ask', { method: 'POST', body: JSON.stringify({ question: 'test' }) });
    console.log(await res.json());
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
