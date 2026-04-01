import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

const API_KEY = process.env.REKAZ_API_KEY;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

const AUTH = Buffer.from(`${API_KEY}:`).toString("base64");

const BASE_URL = "https://platform.rekaz.io/api/public";

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

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

    return res.status(response.status).send({
      status: response.status,
      body: text
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

    return res.status(response.status).send({
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
