import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔴 مهم:
// انسخ Base64 من Rekaz (كما هو) وضعه في Render باسم REKAZ_AUTH
const AUTH = process.env.REKAZ_AUTH;

// 🔴 التينانت
const TENANT_ID = process.env.REKAZ_TENANT_ID;

const BASE_URL = "https://platform.rekaz.io/api/public";

// اختبار السيرفر
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// اختبار المنتجات (تشخيص كامل)
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      method: "GET",
      headers: {
        // ❗ لا تضيف Basic هنا
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const text = await response.text();

    res.json({
      status: response.status,
      body: text
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// اختبار العملاء
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

    res.json({
      status: response.status,
      body: text
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
