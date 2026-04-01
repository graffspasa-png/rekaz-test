const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// الرابط الصحيح لركاز
const BASE_URL = "https://merchant.rekaz.io";

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// API
app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  try {
    // 🔥 products
    if (path === "products") {
      const response = await fetch(`${BASE_URL}/api/public/products`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${process.env.REKAZ_API_KEY}`,
          "__tenant": process.env.REKAZ_TENANT_ID,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();
      return res.json(data);
    }

    // 🔥 create customer
    if (path === "create-customer") {
      const response = await fetch(`${BASE_URL}/api/public/customers`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${process.env.REKAZ_API_KEY}`,
          "__tenant": process.env.REKAZ_TENANT_ID,
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
