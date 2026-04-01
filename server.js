import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// بياناتك من Render
const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

// ✅ الرابط الصحيح 100%
const BASE_URL = "https://platform.rekaz.io/api/public";

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  try {

    // ================= PRODUCTS =================
    if (path === "products") {
      const response = await fetch(`${BASE_URL}/products`, {
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

    // ================= CUSTOMERS =================
    if (path === "customers") {
      const response = await fetch(`${BASE_URL}/customers`, {
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

    res.status(400).json({ error: "Invalid path" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
