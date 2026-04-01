const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// القيم من Render
const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// الرابط الصحيح
const BASE_URL = "https://api.rekaz.com";

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  try {

    // ✅ المنتجات
    if (path === "products") {
      const response = await fetch(`${BASE_URL}/api/public/products`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${API_KEY}`,
          "__tenant": TENANT_ID,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();
      return res.json(data);
    }

    // ✅ إنشاء عميل (لو احتجناه لاحقًا)
    if (path === "create-customer") {
      const response = await fetch(`${BASE_URL}/api/public/customers`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${API_KEY}`,
          "__tenant": TENANT_ID,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "عميل تجريبي",
          phone: "0500000000"
        })
      });

      const data = await response.json();
      return res.json(data);
    }

    res.status(400).json({ error: "Invalid path" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
