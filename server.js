import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// CORS - يسمح للموقع على GitHub Pages بالتحدث مع الباكند
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const BASE_URL = "https://platform.rekaz.io/api/public";
const headers = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};

app.get("/products", async (req, res) => {
  try {
    const r = await fetch(`${BASE_URL}/products`, { headers });
    const text = await r.text();
    if (!text) {
      return res.status(500).json({ error: "Empty response from Rekaz" });
    }
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.json({ raw: text });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/slots", async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const r = await fetch(`${BASE_URL}/reservations/slots?${query}`, { headers });
    const text = await r.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/book", async (req, res) => {
  try {
    const { customerDetails, branchId, items } = req.body;
    const r = await fetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ customerDetails, branchId, items })
    });
    const text = await r.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
