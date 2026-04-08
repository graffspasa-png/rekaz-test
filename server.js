import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const BASE_URL = "https://platform.rekaz.io/api/public";
const REKAZ_BASE = "https://platform.rekaz.io";
const REKAZ_HEADERS = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};
const BRANCH_ID = process.env.REKAZ_BRANCH_ID;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "graff2026";
const CONFIG_FILE = "/tmp/graff_config.json";

// ── Default config ──
const DEFAULT_CONFIG = {
  ui: {
    primaryColor: "#b8965a",
    backgroundColor: "#080807",
    textColor: "#17150e",
    fontFamily: "Tajawal",
    buttonStyle: "sharp",
    heroTagline: "حيث تلتقي العناية بالفخامة · في أدق تفاصيلها"
  },
  social: {
    instagram: "",
    tiktok: "",
    whatsapp: "966500000000",
    twitter: "",
    snapchat: ""
  },
  sections: [],
  pages: [],
  buttons: [
    { id: "book", text: "احجزي موعدك الآن", visible: true, link: "booking" },
    { id: "gift", text: "أهدي من تحبين · Gift Card", visible: true, link: "gift" },
    { id: "contact", text: "تواصلي معنا", visible: true, link: "whatsapp" }
  ]
};

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (e) {
    console.log("Config load error, using default:", e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

// ── Rekaz helper ──
async function rekazFetch(url, options = {}) {
  console.log(`[Rekaz] ${options.method || "GET"} ${url}`);
  const r = await fetch(url, { ...options, headers: { ...REKAZ_HEADERS, ...(options.headers || {}) } });
  const text = await r.text();
  console.log(`[Rekaz] ${r.status} — ${text.substring(0, 300)}`);
  if (!text) throw new Error("Empty response from Rekaz");
  return { status: r.status, ok: r.ok, text, json: () => JSON.parse(text) };
}

const otpStore = {};

// ══════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════

app.get("/", (req, res) => res.send("GRAFF SPA Backend ✅"));

// GET /config — frontend reads this
app.get("/config", (req, res) => {
  res.json(loadConfig());
});

// GET /products
app.get("/products", async (req, res) => {
  try {
    const r = await rekazFetch(`${BASE_URL}/products`);
    if (!r.ok) return res.status(r.status).json({ error: "Failed to load products" });
    res.json(r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /slots
app.get("/slots", async (req, res) => {
  try {
    const q = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${BASE_URL}/reservations/slots?${q}`);
    res.status(r.status).send(r.text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /send-otp
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000, verified: false };
  console.log(`[OTP] ${phone}: ${otp}`);
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
    const check = await rekazFetch(`${BASE_URL}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if (check.ok) {
      const d = check.json();
      if (d.items && d.items.length > 0) return res.json({ customerId: d.items[0].id });
    }
    const r = await rekazFetch(`${BASE_URL}/customers`, {
      method: "POST",
      body: JSON.stringify({ name, mobileNumber: mobile, type: 1 })
    });
    if (!r.ok) return res.status(r.status).json({ error: "فشل إنشاء العميل" });
    res.json({ customerId: r.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /create-booking
app.post("/create-booking", async (req, res) => {
  const { customerId, phone, priceId, from, to } = req.body;
  if (!customerId || !priceId || !from || !to) return res.status(400).json({ error: "Missing required fields" });
  if (phone) {
    const stored = otpStore[phone];
    if (!stored || !stored.verified) return res.status(403).json({ error: "Phone not verified" });
  }
  try {
    const r = await rekazFetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST",
      body: JSON.stringify({
        customerDetails: null, customerId, branchId: BRANCH_ID,
        items: [{ priceId, quantity: 1, from, to }]
      })
    });
    if (!r.ok) return res.status(r.status).json({ error: "فشل إنشاء الحجز", details: r.text });
    const result = r.json();
    if (phone) delete otpStore[phone];
    const paymentPath = result.paymentLink || "";
    const paymentUrl = paymentPath
      ? (paymentPath.startsWith("http") ? paymentPath : `${REKAZ_BASE}${paymentPath}`)
      : null;
    const orderNumber = result.orderId || result.orderNumber || result.reservationNumber || null;
    console.log(`[Booking] Order: ${orderNumber} | Pay: ${paymentUrl}`);
    res.json({ success: true, orderNumber, paymentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
//  ADMIN API — protected by password
// ══════════════════════════════════════════

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (token !== ADMIN_PASS) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// POST /admin/login
app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASS) {
    res.json({ success: true, token: ADMIN_PASS });
  } else {
    res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  }
});

// GET /admin/config
app.get("/admin/config", adminAuth, (req, res) => {
  res.json(loadConfig());
});

// PUT /admin/config — save full config
app.put("/admin/config", adminAuth, (req, res) => {
  try {
    const config = req.body;
    saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/config/:section — save one section
app.put("/admin/config/:section", adminAuth, (req, res) => {
  try {
    const config = loadConfig();
    config[req.params.section] = req.body;
    saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/products — fetch Rekaz products for admin
app.get("/admin/products", adminAuth, async (req, res) => {
  try {
    const r = await rekazFetch(`${BASE_URL}/products`);
    if (!r.ok) return res.status(r.status).json({ error: "Failed" });
    res.json(r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Port ${PORT}`));
