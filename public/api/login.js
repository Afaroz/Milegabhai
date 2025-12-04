export default async function handler(req, res) {
  try {
    const response = await fetch("https://milegabhai.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ message: "Proxy error" });
  }
}
