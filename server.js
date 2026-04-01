import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔑 بيانات Render
const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// 🔥 جرب الطريقتين (Rekaz يختلف حسب الحساب)
const AUTH_RAW = API_KEY;
const AUTH_BASE64 = Buffer.from(`${API_KEY}:`).toString("base64");

// ✅ الرابط الصحيح
const BASE_URL = "https://platform.rekaz.io/api/public";


// ============================
// 🟢 اختبار السيرفر
// ============================
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});


// ============================
// 🔥 دالة ذكية تحاول الطريقتين
// ============================
async function fetchRekaz(endpoint) {
  // المحاولة الأولى (بدون تشفير)
  let response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${AUTH_RAW}`,
      "__tenant": TENANT_ID,
      "Content-Type": "application/json"
    }
  });

  let text = await response.text();

  // إذا فاضي أو خطأ → نجرب Base64
  if (!text || response.status !== 200) {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH_BASE64}`,
        "__tenant": TENANT_ID,
        "Content-Type": "application/json"
      }
    });

    text = await response.text();
  }

  return {
    status: response.status,
    body: text
  };
}


// ============================
// 📦 المنتجات
// ============================
app.get("/products", async (req, res) => {
  try {
    const result = await fetchRekaz("/products");

    if (!result.body) {
      return res.status(500).json({
        error: "Empty response from Rekaz",
        hint: "Check API KEY or TENANT ID"
      });
    }

    try {
      const data = JSON.parse(result.body);
      return res.status(result.status).json(data);
    } catch {
      return res.status(result.status).json({
        error: "Response is not JSON",
        raw: result.body
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================
// 👥 العملاء
// ============================
app.get("/customers", async (req, res) => {
  try {
    const result = await fetchRekaz("/customers");

    if (!result.body) {
      return res.status(500).json({
        error: "Empty response from Rekaz",
        hint: "Check API KEY or TENANT ID"
      });
    }

    try {
      const data = JSON.parse(result.body);
      return res.status(result.status).json(data);
    } catch {
      return res.status(result.status).json({
        error: "Response is not JSON",
        raw: result.body
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================
// 🔄 Endpoint مرن
// ============================
app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  if (!path) {
    return res.status(400).json({ error: "Missing path" });
  }

  try {
    const result = await fetchRekaz(path);

    if (!result.body) {
      return res.status(500).json({
        error: "Empty response from Rekaz"
      });
    }

    try {
      const data = JSON.parse(result.body);
      return res.status(result.status).json(data);
    } catch {
      return res.status(result.status).json({
        error: "Response is not JSON",
        raw: result.body
      });
    }

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
