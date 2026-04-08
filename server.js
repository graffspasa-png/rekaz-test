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

const REKAZ_API  = "https://platform.rekaz.io/api/public";
const REKAZ_BASE = "https://platform.rekaz.io";
const REKAZ_HDR  = {
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
};
const BRANCH_ID  = process.env.REKAZ_BRANCH_ID;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "graff2026";
const DB_FILE    = "/tmp/graff_db.json";

// ── Default DB ──────────────────────────────────────────────────
const DEFAULT_DB = {
  categories: [],   // { id, nameAr, nameEn, order, visible }
  services: [],     // { id, rekazPriceId, rekazProductId, categoryId, nameAr, order, visible }
  theme: {
    primaryColor: "#b8965a",
    primaryHover:  "#c8a66a",
    bgDark:  "#080807",
    bgDark2: "#0c0b09",
    bgLight: "#f3ede3",
    textColor:   "#17150e",
    mutedColor:  "#78706a",
    borderColor: "#d8d0c0",
    fontArabic:  "Tajawal",
    fontDisplay: "Cormorant Garamond",
    borderRadius: 0
  },
  layout: {
    heroTagline: "حيث تلتقي العناية بالفخامة · في أدق تفاصيلها",
    heroCity:    "R I Y A D H",
    logoText:    "GRAFF SPA",
    vatNumber:   "314257469500003"
  },
  social: { instagram:"", tiktok:"", whatsapp:"966500000000", twitter:"", snapchat:"" },
  buttons: [
    { id:"btn_1", textAr:"احجزي موعدك الآن", action:"booking", style:"primary", order:1, visible:true },
    { id:"btn_2", textAr:"أهدي من تحبين",    action:"gift",    style:"outline", order:2, visible:true },
    { id:"btn_3", textAr:"العضويات",          action:"memberships", style:"outline", order:3, visible:true },
    { id:"btn_4", textAr:"تواصلي معنا",       action:"whatsapp", style:"outline", order:4, visible:true }
  ],
  payments: [
    { id:"mastercard", label:"Mastercard", visible:true, order:1 },
    { id:"visa",       label:"Visa",       visible:true, order:2 },
    { id:"mada",       label:"mada",       visible:true, order:3 },
    { id:"applepay",   label:"Apple Pay",  visible:true, order:4 },
    { id:"tabby",      label:"tabby",      visible:true, order:5 },
    { id:"tamara",     label:"tamara",     visible:true, order:6 }
  ],
  pages: {
    gift: {
      enabled: true,
      sections: [
        { type:"title",  value:"بطاقة الإهداء" },
        { type:"text",   value:"اهدي تجربة لا تُنسى لمن تحبين" },
        { type:"amounts", values:[200,300,500,1000] }
      ]
    },
    memberships: {
      enabled: true,
      items: [
        { name:"Classic", price:4000, featured:false, features:["مناكير روسي كامل","علاج فيشيال للبشرة","12 زيارة / 12 شهراً"] },
        { name:"VIP",     price:8000, featured:true,  features:["جل اكستنشن أو بياب","مناكير روسي","علاج فيشيال","12 زيارة / 12 شهراً"] },
        { name:"V-VIP",   price:10000,featured:false, features:["كل مميزات VIP","رموش كلاسيك","30 دقيقة مساج","12 زيارة / 12 شهراً"] }
      ]
    }
  },
  custom_pages: []
};

// ── DB helpers ─────────────────────────────────────────────────
function readDB() {
  try {
    if (existsSync(DB_FILE)) {
      const raw = JSON.parse(readFileSync(DB_FILE, "utf8"));
      // Deep merge to ensure all keys exist
      return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
    }
  } catch(e) { console.error("DB read error:", e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}
function writeDB(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Rekaz products cache
let rCache = null, rCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;
const otpStore = {};

async function rekazFetch(url, opts = {}) {
  console.log(`[Rekaz] ${opts.method||"GET"} ${url}`);
  const r = await fetch(url, { ...opts, headers: { ...REKAZ_HDR, ...(opts.headers||{}) } });
  const text = await r.text();
  console.log(`[Rekaz] ${r.status}: ${text.slice(0,200)}`);
  if (!text) throw new Error("Empty Rekaz response");
  return { ok: r.ok, status: r.status, text, json: () => JSON.parse(text) };
}

async function getRekazProducts() {
  const now = Date.now();
  if (rCache && now - rCacheTime < CACHE_TTL) return rCache;
  const r = await rekazFetch(`${REKAZ_API}/products`);
  if (!r.ok) throw new Error("Rekaz products failed: " + r.status);
  rCache = r.json(); rCacheTime = now;
  return rCache;
}

// ── ADMIN AUTH ─────────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (token !== ADMIN_PASS) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ══════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════

app.get("/", (req, res) => res.send("GRAFF SPA API ✅"));

// Full site config — frontend reads this once
app.get("/site", (req, res) => {
  const db = readDB();
  // Only expose what frontend needs
  res.json({
    theme:    db.theme,
    layout:   db.layout,
    social:   db.social,
    buttons:  db.buttons.filter(b => b.visible !== false).sort((a,b) => a.order - b.order),
    payments: db.payments.filter(p => p.visible !== false).sort((a,b) => a.order - b.order),
    pages:    db.pages,
    custom_pages: db.custom_pages.filter(p => p.visible !== false)
  });
});

// Structured booking menu — categories + services merged with Rekaz data
app.get("/menu", async (req, res) => {
  try {
    const db = readDB();
    const rekazData = await getRekazProducts();
    const rekazItems = rekazData.items || [];

    // Build a map: priceId → rekaz product
    const byPriceId = {};
    const byProductId = {};
    rekazItems.forEach(p => {
      byProductId[p.id] = p;
      if (p.pricing) p.pricing.forEach(pr => { byPriceId[pr.id] = { product: p, pricing: pr }; });
      // Also allow matching by product id as priceId (for single-price products)
      if (!p.pricing || p.pricing.length === 0) byPriceId[p.id] = { product: p, pricing: null };
    });

    // Build categories with their services
    const cats = db.categories
      .filter(c => c.visible !== false)
      .sort((a,b) => a.order - b.order)
      .map(cat => {
        const services = db.services
          .filter(s => s.categoryId === cat.id && s.visible !== false)
          .sort((a,b) => a.order - b.order)
          .map(s => {
            // Find Rekaz data for this service
            const rData = byPriceId[s.rekazPriceId] || (s.rekazProductId ? { product: byProductId[s.rekazProductId], pricing: null } : null);
            if (!rData || !rData.product) return null; // Rekaz product not found — skip
            const p = rData.product;
            return {
              id: s.id,
              rekazPriceId: s.rekazPriceId,
              rekazProductId: p.id,
              nameAr: s.nameAr || (p.nameAr || p.name || "").split(" - ")[0].trim(),
              amount: rData.pricing ? rData.pricing.amount : (p.amount || 0),
              duration: rData.pricing ? (rData.pricing.duration || p.duration || 0) : (p.duration || 0),
              description: p.description || p.shortDescription || "",
              hasVariants: p.pricing && p.pricing.length > 1,
              variants: p.pricing && p.pricing.length > 1 ? p.pricing.map(pr => ({
                id: pr.id, name: pr.name || "", amount: pr.amount, duration: pr.duration || p.duration || 0
              })) : [],
              addOns: (p.addOns || []).map(ao => ({
                id: ao.id,
                nameAr: (ao.nameAr || ao.name || "").split(" - ")[0].trim(),
                amount: ao.amount || 0
              }))
            };
          })
          .filter(Boolean);

        return { id: cat.id, nameAr: cat.nameAr, nameEn: cat.nameEn || "", services };
      })
      .filter(c => c.services.length > 0); // Hide empty categories

    res.json({ categories: cats });
  } catch(e) {
    console.error("[/menu]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Rekaz slots
app.get("/slots", async (req, res) => {
  try {
    const q = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${REKAZ_API}/reservations/slots?${q}`);
    res.status(r.status).send(r.text);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// OTP
app.post("/send-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000, verified: false };
  console.log(`[OTP] ${phone}: ${otp}`);
  res.json({ success: true, debug_otp: otp });
});
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  const s = otpStore[phone];
  if (!s) return res.status(400).json({ error: "أرسلي رمزاً جديداً" });
  if (Date.now() > s.expires) { delete otpStore[phone]; return res.status(400).json({ error: "انتهت صلاحية الرمز" }); }
  if (s.otp !== otp.toString()) return res.status(400).json({ error: "الرمز غير صحيح" });
  otpStore[phone].verified = true;
  res.json({ success: true });
});

// Customer + Booking
app.post("/create-customer", async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });
  const s = otpStore[phone];
  if (!s || !s.verified) return res.status(403).json({ error: "يجب التحقق من الجوال أولاً" });
  try {
    const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");
    const chk = await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if (chk.ok) { const d = chk.json(); if (d.items?.length) return res.json({ customerId: d.items[0].id }); }
    const r = await rekazFetch(`${REKAZ_API}/customers`, { method:"POST", body: JSON.stringify({ name, mobileNumber: mobile, type: 1 }) });
    if (!r.ok) return res.status(r.status).json({ error: "فشل إنشاء العميل" });
    res.json({ customerId: r.json() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/create-booking", async (req, res) => {
  const { customerId, phone, priceId, from, to } = req.body;
  if (!customerId || !priceId || !from || !to) return res.status(400).json({ error: "Missing fields" });
  if (phone) { const s = otpStore[phone]; if (!s?.verified) return res.status(403).json({ error: "Phone not verified" }); }
  try {
    const r = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
      method: "POST",
      body: JSON.stringify({ customerDetails: null, customerId, branchId: BRANCH_ID, items: [{ priceId, quantity: 1, from, to }] })
    });
    if (!r.ok) return res.status(r.status).json({ error: "فشل الحجز", details: r.text });
    const result = r.json();
    if (phone) delete otpStore[phone];
    const payPath = result.paymentLink || "";
    const payUrl = payPath ? (payPath.startsWith("http") ? payPath : `${REKAZ_BASE}${payPath}`) : null;
    const orderNumber = result.orderId || result.orderNumber || result.reservationNumber || null;
    console.log(`[Booking] Order:${orderNumber} Pay:${payUrl}`);
    res.json({ success: true, orderNumber, payUrl });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════

app.post("/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASS) res.json({ success: true, token: ADMIN_PASS });
  else res.status(401).json({ error: "كلمة المرور غير صحيحة" });
});

// GET full DB
app.get("/admin/db", auth, (req, res) => res.json(readDB()));

// PUT full DB
app.put("/admin/db", auth, (req, res) => {
  try { writeDB(req.body); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Categories ──
app.get("/admin/categories", auth, (req, res) => res.json(readDB().categories));

app.post("/admin/categories", auth, (req, res) => {
  const db = readDB();
  const cat = { id: "cat_" + uid(), nameAr: req.body.nameAr || "قسم جديد", nameEn: req.body.nameEn || "", order: db.categories.length + 1, visible: true };
  db.categories.push(cat);
  writeDB(db);
  res.json(cat);
});

app.put("/admin/categories/:id", auth, (req, res) => {
  const db = readDB();
  const i = db.categories.findIndex(c => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  db.categories[i] = { ...db.categories[i], ...req.body, id: req.params.id };
  writeDB(db);
  res.json(db.categories[i]);
});

app.delete("/admin/categories/:id", auth, (req, res) => {
  const db = readDB();
  db.categories = db.categories.filter(c => c.id !== req.params.id);
  // Also remove services in this category
  db.services = db.services.filter(s => s.categoryId !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// Reorder categories
app.put("/admin/categories-order", auth, (req, res) => {
  const db = readDB();
  const { order } = req.body; // array of ids
  order.forEach((id, idx) => {
    const i = db.categories.findIndex(c => c.id === id);
    if (i >= 0) db.categories[i].order = idx + 1;
  });
  writeDB(db);
  res.json({ success: true });
});

// ── Services ──
app.get("/admin/services", auth, (req, res) => {
  const db = readDB();
  const { categoryId } = req.query;
  const svcs = categoryId ? db.services.filter(s => s.categoryId === categoryId) : db.services;
  res.json(svcs.sort((a,b) => a.order - b.order));
});

app.post("/admin/services", auth, (req, res) => {
  const db = readDB();
  const { categoryId, rekazPriceId, rekazProductId, nameAr } = req.body;
  if (!categoryId || !rekazPriceId) return res.status(400).json({ error: "categoryId and rekazPriceId required" });
  // Prevent duplicate
  if (db.services.find(s => s.rekazPriceId === rekazPriceId && s.categoryId === categoryId)) {
    return res.status(409).json({ error: "Service already in this category" });
  }
  const catSvcs = db.services.filter(s => s.categoryId === categoryId);
  const svc = {
    id: "srv_" + uid(),
    rekazPriceId,
    rekazProductId: rekazProductId || null,
    categoryId,
    nameAr: nameAr || "",
    order: catSvcs.length + 1,
    visible: true
  };
  db.services.push(svc);
  writeDB(db);
  res.json(svc);
});

app.put("/admin/services/:id", auth, (req, res) => {
  const db = readDB();
  const i = db.services.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  db.services[i] = { ...db.services[i], ...req.body, id: req.params.id };
  writeDB(db);
  res.json(db.services[i]);
});

app.delete("/admin/services/:id", auth, (req, res) => {
  const db = readDB();
  db.services = db.services.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// Bulk set services for a category
app.put("/admin/categories/:id/services", auth, (req, res) => {
  const db = readDB();
  const catId = req.params.id;
  const { priceIds } = req.body; // array of { rekazPriceId, rekazProductId, nameAr }
  // Remove old services for this category
  db.services = db.services.filter(s => s.categoryId !== catId);
  // Add new ones
  priceIds.forEach((item, idx) => {
    db.services.push({
      id: "srv_" + uid(),
      rekazPriceId: item.rekazPriceId,
      rekazProductId: item.rekazProductId || null,
      categoryId: catId,
      nameAr: item.nameAr || "",
      order: idx + 1,
      visible: true
    });
  });
  writeDB(db);
  res.json({ success: true, count: priceIds.length });
});

// ── Theme ──
app.put("/admin/theme", auth, (req, res) => {
  const db = readDB();
  db.theme = { ...db.theme, ...req.body };
  writeDB(db);
  res.json(db.theme);
});

// ── Layout ──
app.put("/admin/layout", auth, (req, res) => {
  const db = readDB();
  db.layout = { ...db.layout, ...req.body };
  writeDB(db);
  res.json(db.layout);
});

// ── Social ──
app.put("/admin/social", auth, (req, res) => {
  const db = readDB();
  db.social = { ...db.social, ...req.body };
  writeDB(db);
  res.json(db.social);
});

// ── Buttons ──
app.put("/admin/buttons", auth, (req, res) => {
  const db = readDB();
  db.buttons = req.body;
  writeDB(db);
  res.json({ success: true });
});

// ── Payments ──
app.put("/admin/payments", auth, (req, res) => {
  const db = readDB();
  db.payments = req.body;
  writeDB(db);
  res.json({ success: true });
});

// ── Pages ──
app.put("/admin/pages", auth, (req, res) => {
  const db = readDB();
  db.pages = req.body;
  writeDB(db);
  res.json({ success: true });
});

// ── Admin: get Rekaz products ──
app.get("/admin/rekaz-products", auth, async (req, res) => {
  try {
    const data = await getRekazProducts();
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[GRAFF SPA] Server on port ${PORT}`));
