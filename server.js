import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

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

const REKAZ_API = "https://platform.rekaz.io/api/public";
const REKAZ_BASE = "https://platform.rekaz.io";
const REKAZ_HEADERS = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};
const BRANCH_ID = process.env.REKAZ_BRANCH_ID;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "graff2026";
const CONFIG_FILE = "/tmp/graff_config.json";

// Products cache — 10 min
let productsCache = null;
let productsCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

// ── Default config ──
const DEFAULT_CONFIG = {
  ui: {
    primaryColor: "#b8965a",
    primaryColorHover: "#c8a66a",
    bgColor: "#080807",
    bgColor2: "#0c0b09",
    creamColor: "#f3ede3",
    textColor: "#17150e",
    mutedColor: "#78706a",
    borderColor: "#d8d0c0",
    fontArabic: "Tajawal",
    fontDisplay: "Cormorant Garamond",
    buttonRadius: "0",
    heroTagline: "حيث تلتقي العناية بالفخامة · في أدق تفاصيلها",
    heroCity: "R I Y A D H",
    logoText: "GRAFF SPA",
    vatNumber: "314257469500003"
  },
  social: { instagram: "", tiktok: "", whatsapp: "966500000000", twitter: "", snapchat: "" },
  sections: [],
  pages: [],
  memberships: [],
  giftCard: { enabled: true, title: "بطاقة الإهداء", subtitle: "اهدي تجربة لا تُنسى", amounts: [200, 300, 500, 1000] },
  buttons: [
    { id: "book", textAr: "احجزي موعدك الآن", visible: true, action: "booking", style: "primary" },
    { id: "gift", textAr: "أهدي من تحبين", visible: true, action: "gift", style: "outline" },
    { id: "contact", textAr: "تواصلي معنا", visible: true, action: "whatsapp", style: "outline" }
  ],
  paymentLogos: [
    { id: "mastercard", label: "Mastercard", visible: true },
    { id: "visa", label: "Visa", visible: true },
    { id: "mada", label: "mada", visible: true },
    { id: "applepay", label: "Apple Pay", visible: true },
    { id: "tabby", label: "tabby", visible: true },
    { id: "tamara", label: "tamara", visible: true }
  ]
};

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, "utf8");
      return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
    }
  } catch (e) { console.log("Config load error:", e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

// ── Rekaz helper ──
async function rekazFetch(url, options = {}) {
  console.log(`[Rekaz] ${options.method || "GET"} ${url}`);
  if (options.body) console.log(`[Rekaz] Body:`, options.body.substring(0, 200));
  const r = await fetch(url, { ...options, headers: { ...REKAZ_HEADERS, ...(options.headers || {}) } });
  const text = await r.text();
  console.log(`[Rekaz] ${r.status}:`, text.substring(0, 300));
  if (!text) throw new Error("Empty response from Rekaz");
  return { status: r.status, ok: r.ok, text, json: () => JSON.parse(text) };
}

const otpStore = {};

// ══ PUBLIC ENDPOINTS ══

app.get("/", (req, res) => res.send("GRAFF SPA API ✅"));

// GET /config
app.get("/config", (req, res) => res.json(loadConfig()));

// GET /products — with caching
app.get("/products", async (req, res) => {
  try {
    const now = Date.now();
    if (productsCache && now - productsCacheTime < CACHE_TTL) {
      return res.json(productsCache);
    }
    const r = await rekazFetch(`${REKAZ_API}/products`);
    if (!r.ok) return res.status(r.status).json({ error: "Failed to load products" });
    productsCache = r.json();
    productsCacheTime = now;
    res.json(productsCache);
  } catch (err) {
    console.error("[/products]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /slots
app.get("/slots", async (req, res) => {
  try {
    const q = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${REKAZ_API}/reservations/slots?${q}`);
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
  // TODO: connect real SMS
  res.json({ success: true, debug_otp: otp });
});

// POST /verify-otp
app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });
  const stored = otpStore[phone];
  if (!stored) return res.status(400).json({ error: "أرسلي رمزاً جديداً" });
  if (Date.now() > stored.expires) { delete otpStore[phone]; return res.status(400).json({ error: "انتهت صلاحية الرمز، اضغطي إعادة الإرسال" }); }
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
    const check = await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if (check.ok) {
      const d = check.json();
      if (d.items && d.items.length > 0) return res.json({ customerId: d.items[0].id });
    }
    const r = await rekazFetch(`${REKAZ_API}/customers`, {
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
    const r = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
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
    const paymentUrl = paymentPath ? (paymentPath.startsWith("http") ? paymentPath : `${REKAZ_BASE}${paymentPath}`) : null;
    const orderNumber = result.orderId || result.orderNumber || result.reservationNumber || null;
    console.log(`[Booking] Order:${orderNumber} Pay:${paymentUrl}`);
    res.json({ success: true, orderNumber, paymentUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ ADMIN ENDPOINTS ══

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (token !== ADMIN_PASS) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.post("/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASS) res.json({ success: true, token: ADMIN_PASS });
  else res.status(401).json({ error: "كلمة المرور غير صحيحة" });
});

app.get("/admin/config", adminAuth, (req, res) => res.json(loadConfig()));

app.put("/admin/config", adminAuth, (req, res) => {
  try { saveConfig(req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/admin/products", adminAuth, async (req, res) => {
  try {
    const now = Date.now();
    if (productsCache && now - productsCacheTime < CACHE_TTL) return res.json(productsCache);
    const r = await rekazFetch(`${REKAZ_API}/products`);
    if (!r.ok) return res.status(r.status).json({ error: "Failed" });
    productsCache = r.json(); productsCacheTime = now;
    res.json(productsCache);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[GRAFF SPA] Server on port ${PORT}`));
