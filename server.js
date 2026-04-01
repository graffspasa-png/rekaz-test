import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔑 القيم من Render
const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// ✅ تحويل API KEY إلى Base64 (مهم جدًا)
const AUTH = Buffer.from(`${API_KEY}:`).toString("base64");

// ✅ الرابط الصحيح من التوثيق
const BASE_URL = "https://platform.rekaz.io/api/public";

// اختبار السيرفر
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});


// ============================
// 📦 المنتجات
// ============================
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "__tenant": TENANT_ID,
        "Content-Type": "application/json"
      }
    });

    const text = await response.text();

    if (!text) {
      return res.status(500).json({ error: "Empty response from Rekaz" });
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================
// 👥 العملاء
// ============================
app.get("/customers", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/customers`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "__tenant": TENANT_ID,
        "Content-Type": "application/json"
      }
    });

    const text = await response.text();

    if (!text) {
      return res.status(500).json({ error: "Empty response from Rekaz" });
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
