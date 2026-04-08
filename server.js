import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── REQUEST LOGGER ──
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const BASE_URL = "https://platform.rekaz.io/api/public";
const REKAZ_BASE = "https://platform.rekaz.io";
const IS_DEV = process.env.NODE_ENV !== "production";

const REKAZ_HEADERS = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};
const BRANCH_ID = process.env.REKAZ_BRANCH_ID;

// In-memory OTP store
const otpStore = {};

// ── Helper: safe Rekaz fetch ──
async function rekazFetch(url, options = {}) {
  console.log(`[Rekaz] ${options.method || "GET"} ${url}`);
  if (options.body) console.log(`[Rekaz] Body: ${options.body}`);

  const r = await fetch(url, { ...options, headers: { ...REKAZ_HEADERS, ...(options.headers || {}) } });
  const text = await r.text();

  console.log(`[Rekaz] Status: ${r.status}`);
  console.log(`[Rekaz] Response: ${text.substring(0, 500)}`);

  if (!text) throw new Error("Empty response from Rekaz");
  return { status: r.status, ok: r.ok, text, json: () => JSON.parse(text) };
}

// ── GET /products ──
app.get("/products", async (req, res) => {
  try {
    const r = await rekazFetch(`${BASE_URL}/products`);
    if (!r.ok) return res.status(r.status).json({ error: "Failed to load products", details: r.text });
    res.json(r.json());
  } catch (err) {
    console.error("[/products] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /slots ──
app.get("/slots", async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${BASE_URL}/reservations/slots?${query}`);
    res.status(r.status).send(r.text);
  } catch (err) {
    console.error("[/slots] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /send-otp ──
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expires = Date.now() + 5 * 60 * 1000;
  otpStore[phone] = { otp, expires, verified: false };

  console.log(`[OTP] Generated for ${phone}: ${otp}`);

  // TODO: Replace with real SMS (Unifonic / Taqnyat)
  // TEMP: Always return OTP until SMS is connected
  const response = { success: true, message: "OTP sent", debug_otp: otp };

  res.json(response);
});

// ── POST /verify-otp ──
app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

  const stored = otpStore[phone];
  if (!stored) return res.status(400).json({ error: "لم يتم إرسال رمز. اضغطي إرسال الرمز مجدداً" });
  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({ error: "انتهت صلاحية الرمز. اضغطي إعادة الإرسال" });
  }
  if (stored.otp !== otp.toString()) {
    return res.status(400).json({ error: "الرمز غير صحيح. تحققي من الرمز وأعيدي المحاولة" });
  }

  otpStore[phone].verified = true;
  res.json({ success: true });
});

// ── POST /create-customer ──
app.post("/create-customer", async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });

  const stored = otpStore[phone];
  if (!stored || !stored.verified) {
    return res.status(403).json({ error: "يجب التحقق من الجوال أولاً" });
  }

  try {
    const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");

    // Check if customer exists
    const check = await rekazFetch(`${BASE_URL}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if (check.ok) {
      const data = check.json();
      if (data.items && data.items.length > 0) {
        console.log(`[Customer] Found existing: ${data.items[0].id}`);
        return res.json({ customerId: data.items[0].id });
      }
    }

    // Create new customer
    const r = await rekazFetch(`${BASE_URL}/customers`, {
      method: "POST",
      body: JSON.stringify({ name, mobileNumber: mobile, type: 1 })
    });
    if (!r.ok) return res.status(r.status).json({ error: "فشل إنشاء العميل", details: r.text });

    const customerId = r.json();
    console.log(`[Customer] Created: ${customerId}`);
    res.json({ customerId });
  } catch (err) {
    console.error("[/create-customer] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /create-booking ──
app.post("/create-booking", async (req, res) => {
  const { customerId, phone, priceId, from, to } = req.body;

  if (!customerId || !priceId || !from || !to) {
    return res.status(400).json({ error: "Missing required fields: customerId, priceId, from, to" });
  }

  // Verify phone OTP
  if (phone) {
    const stored = otpStore[phone];
    if (!stored || !stored.verified) {
      return res.status(403).json({ error: "يجب التحقق من الجوال أولاً" });
    }
  }

  const bookingBody = {
    customerDetails: null,
    customerId,
    branchId: BRANCH_ID,
    items: [{ priceId, quantity: 1, from, to }]
  };

  try {
    const r = await rekazFetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST",
      body: JSON.stringify(bookingBody)
    });

    if (!r.ok) {
      return res.status(r.status).json({
        error: "فشل إنشاء الحجز في ركاز",
        details: r.text
      });
    }

    const result = r.json();

    // Clear OTP after successful booking
    if (phone) delete otpStore[phone];

    // ✅ FIX: Build payment URL using platform.rekaz.io — NOT graffspa.com
    const paymentPath = result.paymentLink || "";
    const paymentUrl = paymentPath
      ? (paymentPath.startsWith("http")
          ? paymentPath
          : `${REKAZ_BASE}${paymentPath}`)
      : null;

    // Order number: orderId is the readable number, reservationIds are UUIDs
    const orderNumber = result.orderId || result.orderNumber || result.reservationNumber || null;

    console.log(`[Booking] Success - OrderNumber: ${orderNumber}, PaymentURL: ${paymentUrl}`);

    res.json({
      success: true,
      orderNumber,
      paymentUrl
    });
  } catch (err) {
    console.error("[/create-booking] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("GRAFF SPA Backend ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Running on port ${PORT} | DEV=${IS_DEV}`));
