import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const API = axios.create({
  baseURL: "https://api.rekaz.io/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.REKAZ_API_KEY}`,
  },
  timeout: 10000,
});

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

app.get("/rekaz", async (req, res) => {
  const path = req.query.path;

  try {
    if (path === "products") {
      const response = await API.get("/products");
      return res.json(response.data);
    }

    if (path === "create-customer") {
      const response = await API.post("/customers", {
        name: "Test User",
        phone: "0500000000",
      });

      return res.json(response.data);
    }

    return res.status(400).json({ error: "Invalid path" });

  } catch (error) {
    return res.status(500).json({
      message: error.message,
      data: error.response?.data,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
