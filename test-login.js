async function run() {
  const res = await fetch('https://seat-allot-ai.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@enterprise.com', password: 'password123' })
  });
  console.log(res.status, res.statusText);
  const text = await res.text();
  console.log(text);
}

run();
