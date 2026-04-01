import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔴 مهم: انسخ Base64 من Rekaz وضعه في Render
const AUTH = process.env.REKAZ_AUTH;

// 🔴 Tenant ID
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// 🔗 API URL
const BASE_URL = "https://platform.rekaz.io/api/public";

// اختبار السيرفر
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// 📦 المنتجات
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      method: "GET",
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const text = await response.text();

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.json({ error: "Invalid JSON", raw: text });
    }

  } catch (error) {
    res.json({ error: error.message });
  }
});

// 👥 العملاء
app.get("/customers", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/customers`, {
      method: "GET",
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const text = await response.text();

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.json({ error: "Invalid JSON", raw: text });
    }

  } catch (error) {
    res.json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
