import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const BASE_URL = "https://platform.rekaz.io/api/public";
const REKAZ_HEADERS = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};
const BRANCH_ID = process.env.REKAZ_BRANCH_ID;
const otpStore = {};

// GET /products
app.get("/products", async (req, res) => {
  try {
    const r = await fetch(`${BASE_URL}/products`, { headers: REKAZ_HEADERS });
    const text = await r.text();
    if (!text) return res.status(500).json({ error: "Empty response" });
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /slots
app.get("/slots", async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const r = await fetch(`${BASE_URL}/reservations/slots?${query}`, { headers: REKAZ_HEADERS });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /send-otp
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
  console.log(`OTP for ${phone}: ${otp}`);
  res.json({ success: true, debug_otp: otp });
});

// POST /verify-otp
app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });
  const stored = otpStore[phone];
  if (!stored) return res.status(400).json({ error: "أرسلي رمزاً جديداً" });
  if (Date.now() > stored.expires) { delete otpStore[phone]; return res.status(400).json({ error: "انتهت صلاحية الرمز" }); }
  if (stored.otp !== otp.toString()) return res.status(400).json({ error: "الرمز غير صحيح" });
  otpStore[phone].verified = true;
  res.json({ success: true });
});

// POST /create-customer
app.post("/create-customer", async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });
  const stored = otpStore[phone];
  if (!stored || !stored.verified) return res.status(403).json({ error: "يجب التحقق من الجوال أولاً" });
  try {
    const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");
    const checkR = await fetch(`${BASE_URL}/customers?mobileNumber=${encodeURIComponent(mobile)}`, { headers: REKAZ_HEADERS });
    const checkData = await checkR.json();
    if (checkData.items && checkData.items.length > 0) {
      return res.json({ customerId: checkData.items[0].id });
    }
    const r = await fetch(`${BASE_URL}/customers`, {
      method: "POST", headers: REKAZ_HEADERS,
      body: JSON.stringify({ name, mobileNumber: mobile, type: 1 })
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text });
    res.json({ customerId: JSON.parse(text) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /create-booking
app.post("/create-booking", async (req, res) => {
  const { customerId, phone, priceId, from, to } = req.body;
  if (!customerId || !priceId || !from || !to) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (phone) {
    const stored = otpStore[phone];
    if (!stored || !stored.verified) return res.status(403).json({ error: "Phone not verified" });
  }

  const body = {
    customerDetails: null,
    customerId,
    branchId: BRANCH_ID,
    items: [{ priceId, quantity: 1, from, to }]
  };

  console.log("Booking body:", JSON.stringify(body));

  try {
    const r = await fetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST", headers: REKAZ_HEADERS, body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log("Rekaz raw response:", r.status, text);

    if (!r.ok) return res.status(r.status).json({ error: "فشل الحجز في ركاز", details: text });

    const result = JSON.parse(text);
    console.log("Rekaz result parsed:", JSON.stringify(result));

    if (phone) delete otpStore[phone];

    // paymentLink from Rekaz is the path like /orders/pay/XXXX
    const paymentPath = result.paymentLink || "";
    // Build absolute URL
    const paymentUrl = paymentPath
      ? (paymentPath.startsWith("http") ? paymentPath : `https://graffspa.com${paymentPath}`)
      : null;

    // The READABLE order number from Rekaz
    // result.orderId is typically a short readable ID like "ORD-12345"
    // result.reservationIds is array of UUIDs (internal IDs)
    // We want orderId for display
    const orderNumber = result.orderId || result.orderNumber || result.reservationNumber || null;
    const reservationUuid = result.reservationIds && result.reservationIds[0] ? result.reservationIds[0] : null;

    res.json({
      success: true,
      orderNumber,          // readable number to show user
      reservationId: reservationUuid,  // internal UUID
      paymentLink: paymentPath,
      paymentUrl            // full absolute URL
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("GRAFF SPA Backend ✅"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
