import express from "express";
import fetch from "node-fetch";

const app = express();

// ⚠️ حط بياناتك هنا
const AUTH = "Basic PUT_YOUR_BASE64_HERE";
const TENANT = "3a1d7f2c-2ad3-ce53-aad1-80f155af75c8";

// ✅ Base URL الصحيح
const BASE_URL = "https://platform.rekaz.io/api/public";

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// 🟢 PRODUCTS
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      method: "GET",
      headers: {
        Authorization: AUTH,
        __tenant: TENANT,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text(); // ⬅️ مهم جدا

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    // 🟢 نحاول نحول JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ JSON BROKEN:", text.slice(0, 200));
      return res.json({
        error: "Invalid JSON from Rekaz",
        preview: text.slice(0, 200),
      });
    }

    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 🟢 CUSTOMERS
app.get("/customers", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/customers`, {
      method: "GET",
      headers: {
        Authorization: AUTH,
        __tenant: TENANT,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ JSON BROKEN:", text.slice(0, 200));
      return res.json({
        error: "Invalid JSON from Rekaz",
        preview: text.slice(0, 200),
      });
    }

    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
