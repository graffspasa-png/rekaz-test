import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔐 بيانات Rekaz
const AUTH = process.env.REKAZ_AUTH;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// 🔗 API
const BASE_URL = "https://platform.rekaz.io/api/public";

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// 📦 API المنتجات (JSON)
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const text = await response.text();

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (error) {
    res.json({ error: error.message });
  }
});

// 👥 API العملاء (JSON)
app.get("/customers", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/customers`, {
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const text = await response.text();

    if (!text) {
      return res.json({ error: "Empty response from Rekaz" });
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (error) {
    res.json({ error: error.message });
  }
});

// 🌐 عرض المنتجات بشكل جميل (HTML)
app.get("/products-view", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const data = await response.json();

    let html = `
      <html>
      <head>
        <title>Products</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .card { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 10px; }
        </style>
      </head>
      <body>
      <h1>Products</h1>
    `;

    const products = data.items || data;

    products.forEach(p => {
      html += `
        <div class="card">
          <h3>${p.name}</h3>
          <p>💰 السعر: ${p.amount} ريال</p>
          <p>⏱ المدة: ${p.duration || 0} دقيقة</p>
        </div>
      `;
    });

    html += "</body></html>";

    res.send(html);

  } catch (error) {
    res.send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
