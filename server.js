const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔐 المتغيرات من Render
const BASE_URL = "https://api.rekaz.io/v1";
const TENANT_ID = process.env.REKAZ_TENANT_ID;
const API_KEY = process.env.REKAZ_API_KEY;
const SECRET = process.env.REKAZ_SECRET;
const BRANCH_ID = process.env.REKAZ_BRANCH_ID || 1;

// 🔑 headers
const headers = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
  "x-api-secret": SECRET,
  "x-tenant-id": TENANT_ID,
};

// 🎯 endpoint الرئيسي
app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  try {
    if (path === "products") {
      const response = await axios.get(`${BASE_URL}/products`, { headers });
      return res.json(response.data);
    }

    if (path === "create-customer") {
      const response = await axios.post(
        `${BASE_URL}/customers`,
        {
          name: "Test User",
          phone: "0500000000",
        },
        { headers }
      );
      return res.json(response.data);
    }

    return res.status(404).json({ error: "Invalid path" });
  } catch (error) {
    return res
      .status(500)
      .json(error.response?.data || { message: error.message });
  }
});

// 🔔 Webhook
app.post("/rekaz-webhook", (req, res) => {
  console.log("Webhook received:", req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});