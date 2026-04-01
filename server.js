import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

const AUTH = process.env.REKAZ_AUTH;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

const BASE_URL = "https://platform.rekaz.io/api/public";

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// ✅ المنتجات (نظيف)
app.get("/products", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/products`, {
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ العملاء
app.get("/customers", async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/customers`, {
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID
      }
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
