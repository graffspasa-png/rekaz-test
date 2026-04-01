import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔑 القيم من Render
const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// ⚠️ مهم: لا تسوي Base64
const AUTH = API_KEY;

// ✅ الرابط الصحيح
const BASE_URL = "https://platform.rekaz.io/api/public";


// ============================
// 🟢 اختبار السيرفر
// ============================
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


// ============================
// 🔄 Endpoint مرن (اختياري)
// ============================
app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  if (!path) {
    return res.status(400).json({ error: "Missing path" });
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
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
// 🚀 تشغيل السيرفر
// ============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
