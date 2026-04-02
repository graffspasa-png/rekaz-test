import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// CORS
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

// In-memory OTP store (resets on server restart)
const otpStore = {};

// ── GET /products ──
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

// ── GET /slots ──
app.get("/slots", async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const url = `${BASE_URL}/reservations/slots?${query}`;
    console.log("Fetching slots:", url);
    const r = await fetch(url, { headers: REKAZ_HEADERS });
    const text = await r.text();
    console.log("Slots response status:", r.status);
    res.status(r.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /send-otp ──
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore[phone] = { otp, expires };

  console.log(`OTP for ${phone}: ${otp}`); // Log for testing

  // TODO: Replace with real SMS (Taqnyat/Unifonic)
  // For now: return OTP in response for testing
  res.json({ 
    success: true, 
    message: "OTP sent",
    // Remove this in production:
    debug_otp: otp 
  });
});

// ── POST /verify-otp ──
app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

  const stored = otpStore[phone];
  if (!stored) return res.status(400).json({ error: "OTP not found. Request a new one." });
  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({ error: "OTP expired. Request a new one." });
  }
  if (stored.otp !== otp.toString()) {
    return res.status(400).json({ error: "OTP incorrect" });
  }

  // Mark as verified
  otpStore[phone].verified = true;
  res.json({ success: true, message: "Phone verified" });
});

// ── POST /create-customer ──
app.post("/create-customer", async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });

  // Check OTP verified
  const stored = otpStore[phone];
  if (!stored || !stored.verified) {
    return res.status(403).json({ error: "Phone not verified. Complete OTP first." });
  }

  try {
    // Check if customer exists
    const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");
    const checkR = await fetch(`${BASE_URL}/customers?mobileNumber=${encodeURIComponent(mobile)}`, { 
      headers: REKAZ_HEADERS 
    });
    const checkData = await checkR.json();
    
    if (checkData.items && checkData.items.length > 0) {
      console.log("Customer exists:", checkData.items[0].id);
      return res.json({ customerId: checkData.items[0].id, existing: true });
    }

    // Create new customer
    const body = { name, mobileNumber: mobile, type: 1 };
    console.log("Creating customer:", body);
    
    const r = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers: REKAZ_HEADERS,
      body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log("Create customer response:", r.status, text);

    if (!r.ok) return res.status(r.status).json({ error: text });
    
    const customerId = JSON.parse(text);
    res.json({ customerId, existing: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /create-booking ──
app.post("/create-booking", async (req, res) => {
  const { customerId, phone, priceId, from, to } = req.body;
  
  if (!customerId || !priceId || !from || !to) {
    return res.status(400).json({ error: "Missing required fields: customerId, priceId, from, to" });
  }

  // Check OTP verified
  if (phone) {
    const stored = otpStore[phone];
    if (!stored || !stored.verified) {
      return res.status(403).json({ error: "Phone not verified" });
    }
  }

  const body = {
    customerDetails: null,
    customerId: customerId,
    branchId: BRANCH_ID,
    items: [{
      priceId: priceId,
      quantity: 1,
      from: from,
      to: to
    }]
  };

  console.log("Creating booking:", JSON.stringify(body, null, 2));

  try {
    const r = await fetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST",
      headers: REKAZ_HEADERS,
      body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log("Booking response:", r.status, text);

    if (!r.ok) {
      return res.status(r.status).json({ 
        error: "Booking failed", 
        rekaz_response: text,
        body_sent: body
      });
    }

    const result = JSON.parse(text);
    
    // Clear OTP after successful booking
    if (phone) delete otpStore[phone];
    
    res.json({ 
      success: true, 
      orderId: result.orderId,
      reservationIds: result.reservationIds,
      paymentLink: result.paymentLink
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("GRAFF SPA Backend ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
