import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BASE_URL = "https://platform.rekaz.io/api/public";

app.all("/rekaz", async (req, res) => {
  const TENANT_ID = process.env.REKAZ_TENANT_ID;
  const API_KEY = process.env.REKAZ_API_KEY;
  const SECRET = process.env.REKAZ_SECRET;
  const BRANCH_ID = process.env.REKAZ_BRANCH_ID;

  const encoded = Buffer.from(API_KEY + ":" + SECRET).toString("base64");

  const path = req.query.path || "";

  const params = { ...req.query };
  delete params.path;

  const qs =
    Object.keys(params).length > 0
      ? "?" + new URLSearchParams(params).toString()
      : "";

  const url = BASE_URL + "/" + path + qs;

  try {
    const options = {
      method: req.method,
      headers: {
        Authorization: "Basic " + encoded,
        __tenant: TENANT_ID,
        "x-branch-id": BRANCH_ID,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (req.method === "POST" || req.method === "PUT") {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const data = await response.text();

    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/rekaz-webhook", (req, res) => {
  console.log("Webhook:", req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
