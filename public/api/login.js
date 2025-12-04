export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch("https://milegabhai.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Render backend not reachable" });
  }
}
