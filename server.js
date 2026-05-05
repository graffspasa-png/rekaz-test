import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const REKAZ_API  = "https://platform.rekaz.io/api/public";
const REKAZ_BASE = "https://platform.rekaz.io";
const RH = () => ({
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
});
const BRANCH_ID  = process.env.REKAZ_BRANCH_ID;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "graff2026";

const DISK_PATHS = ["/var/data/graff_db.json", "/tmp/graff_db.json"];
let MEM_DB = null;

// ── SUPABASE CONFIG ──
const SB_URL    = process.env.SUPABASE_URL || "";
const SB_KEY    = process.env.SUPABASE_ANON_KEY || "";
const SB_TABLE  = "graff_config";
const SB_ROW    = "main_db";

async function sbRead() {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/${SB_TABLE}?key=eq.${SB_ROW}&select=value`,
      { headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" } }
    );
    if (!r.ok) { console.log("[SB] Read failed:", r.status, await r.text()); return null; }
    const rows = await r.json();
    if (!rows || !rows.length) return null;
    return rows[0].value;
  } catch(e) { console.log("[SB] Read error:", e.message); return null; }
}

async function sbWrite(db) {
  if (!SB_URL || !SB_KEY) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/${SB_TABLE}`,
      {
        method: "POST",
        headers: {
          "apikey": SB_KEY,
          "Authorization": `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({ key: SB_ROW, value: db, updated_at: new Date().toISOString() })
      }
    );
    if (!r.ok) { console.log("[SB] Write failed:", r.status, await r.text()); return false; }
    console.log("[SB] Saved ✓");
    return true;
  } catch(e) { console.log("[SB] Write error:", e.message); return false; }
}

const DEFAULT_DB = {
  categories: [],
  services: [],
  // ✅ جديد: إعدادات الإهداء والعضوية
  giftConfig: {
    productId: null,
    priceIds: {}  // { "400": "id", "500": "id", ... }
  },
  membershipConfig: {
    productId: null,
    priceId: null
  },
  texts: {
    homeTagline: "حيث تلتقي العناية بالفخامة · في أدق تفاصيلها",
    homeCity: "R I Y A D H",
    logoText: "GRAFF SPA",
    vatNumber: "314257469500003",
    homeEyebrow: "LUXURY SPA & WELLNESS",
    bookingStep1Title: "اختاري خدمتك",
    bookingStep1Sub: "خدمة واحدة لكل حجز",
    bookingStep2Title: "اختاري الموعد",
    bookingStep3Title: "التحقق من الهوية",
    bookingStep3Sub: "سنرسل رمز التحقق لجوالك",
    bookingConfirmTitle: "تأكيد الحجز",
    bookingConfirmSub: "راجعي تفاصيل حجزك وأتممي الدفع",
    paymentSafeText: "دفع آمن ومشفر · سيتم تحويلك لإتمام العملية",
    giftTitle: "بطاقة الإهداء",
    giftSubtitle: "اهدي تجربة لا تُنسى لمن تحبين",
    giftEyebrow: "GIFT CARD",
    membershipsTitle: "العضويات",
    membershipsSub: "اختاري الباقة المناسبة وتمتعي بامتيازات حصرية",
    membershipsEyebrow: "MEMBERSHIPS",
    footerDesc: "وجهتك الأولى للعناية الفاخرة في الرياض — تجربة راقية لا تُنسى",
    footerCopy: "© 2026 GRAFF SPA · Riyadh · جميع الحقوق محفوظة",
    whatsappNumber: "966500000000",
    btn1Text: "احجزي موعدك الآن",
    btn2Text: "أهدي من تحبين",
    btn3Text: "العضويات",
    btn4Text: "تواصلي معنا",
    giftCardLogoLine1: "GRAFF SPA",
    giftCardTagEn: "Gift Card",
    giftCardTagAr: "بطاقة الإهداء",
    giftCardCurrency: "SAR",
    memberCardLogoText: "GRAFF SPA",
    memberCardTitleEn: "Elite Membership",
    memberCardTitleAr: "عضوية النخبة",
    memberCardPlanName: "ELITE"
  },
  theme: {
    primaryColor:"#b8965a", primaryHover:"#c8a66a",
    bgDark:"#080807", bgDark2:"#0c0b09",
    bgLight:"#f3ede3", textColor:"#17150e",
    mutedColor:"#78706a", borderColor:"#d8d0c0",
    fontArabic:"Tajawal", fontDisplay:"Cormorant Garamond",
    borderRadius:0, logoAccent:"#b8965a",
    subEnSize:26, subArSize:22
  },
  layout: { logoText:"GRAFF SPA", logoImage:"", vatNumber:"314257469500003" },
  social: {
    instagram:"", instagram_user:"",
    tiktok:"", tiktok_user:"",
    whatsapp:"966500000000",
    twitter:"", twitter_user:"",
    snapchat:"", snapchat_user:""
  },
  buttons: [
    {id:"btn_1",textAr:"احجزي موعدك الآن",action:"booking",style:"primary",order:1,visible:true},
    {id:"btn_2",textAr:"أهدي من تحبين",action:"gift",style:"outline",order:2,visible:true},
    {id:"btn_3",textAr:"العضويات",action:"memberships",style:"outline",order:3,visible:true},
    {id:"btn_4",textAr:"تواصلي معنا",action:"whatsapp",style:"outline",order:4,visible:true}
  ],
  payments: [
    {id:"mastercard",label:"Mastercard",visible:true,order:1,customImage:""},
    {id:"visa",label:"Visa",visible:true,order:2,customImage:""},
    {id:"mada",label:"mada",visible:true,order:3,customImage:""},
    {id:"applepay",label:"Apple Pay",visible:true,order:4,customImage:""},
    {id:"tabby",label:"tabby",visible:true,order:5,customImage:""},
    {id:"tamara",label:"tamara",visible:true,order:6,customImage:""}
  ],
  policies: {
    ar: "السياسات العامة:\n• يمكن تعديل الموعد أو تغييره فقط في حال توفر إمكانية في نفس يوم الموعد\n• في حال التأخر 15 دقيقة، يتم إلغاء الموعد تلقائياً",
    en: ""
  },
  pages: {
    gift: {
      title:"بطاقة الإهداء", subtitle:"اهدي تجربة لا تُنسى لمن تحبين",
      eyebrow:"GIFT CARD",
      amounts:[400,500,700,1000]
    },
    memberships: {
      heroTitle:"عضوية النخبة",
      heroSubtitle:"تجربة فاخرة لا تُنسى — امتيازات حصرية لعضو مميز",
      items:[
        {name:"Classic",price:4000,featured:false,visits:12,features:["مناكير روسي كامل","علاج فيشيال للبشرة","12 زيارة / 12 شهراً"]},
        {name:"VIP",price:8000,featured:true,visits:12,features:["جل اكستنشن أو بياب","مناكير روسي","علاج فيشيال","رموش كلاسيك","12 زيارة / 12 شهراً"]},
        {name:"V-VIP",price:10000,featured:false,visits:12,features:["كل مميزات VIP","30 دقيقة مساج","استشوار وقص","خدمات منزلية","12 زيارة / 12 شهراً"]}
      ]
    }
  }
};

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const k of Object.keys(source || {})) {
    if (source[k] && typeof source[k] === "object" && !Array.isArray(source[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], source[k]);
    } else { out[k] = source[k]; }
  }
  return out;
}

async function readDB() {
  if (MEM_DB && MEM_DB._cachedAt && (Date.now() - MEM_DB._cachedAt) < 30000) return MEM_DB;

  const sbData = await sbRead();
  if (sbData) {
    MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), sbData);
    MEM_DB._cachedAt = Date.now();
    console.log("[DB] Loaded from Supabase ✓");
    return MEM_DB;
  }

  for (const p of DISK_PATHS) {
    try {
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, "utf8"));
        MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
        MEM_DB._cachedAt = Date.now();
        console.log(`[DB] Loaded from file ${p}`);
        return MEM_DB;
      }
    } catch(e) { console.log(`Read ${p} failed:`, e.message); }
  }

  if (process.env.INITIAL_DB) {
    try {
      const raw = JSON.parse(Buffer.from(process.env.INITIAL_DB, "base64").toString());
      MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
      MEM_DB._cachedAt = Date.now();
      return MEM_DB;
    } catch(e) {}
  }

  MEM_DB = JSON.parse(JSON.stringify(DEFAULT_DB));
  MEM_DB._cachedAt = Date.now();
  return MEM_DB;
}

async function writeDB(db) {
  const { _cachedAt, ...cleanDB } = db;
  MEM_DB = { ...db, _cachedAt: Date.now() };

  const sbOk = await sbWrite(cleanDB);

  for (const p of DISK_PATHS) {
    try {
      const dir = p.substring(0, p.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, JSON.stringify(cleanDB, null, 2), "utf8");
      if (!sbOk) console.log(`[DB] Saved to file ${p}`);
      return;
    } catch(e) { console.log(`Write ${p} failed:`, e.message); }
  }
  if (!sbOk) console.warn("[DB] WARNING: No persistent storage!");
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

let rCache = null, rCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;
const otpStore = {};

async function rekazFetch(url, opts = {}) {
  console.log(`[Rekaz] ${opts.method||"GET"} ${url}`);
  const r = await fetch(url, { ...opts, headers: { ...RH(), ...(opts.headers||{}) } });
  const text = await r.text();
  console.log(`[Rekaz] ${r.status}: ${text.slice(0,200)}`);
  return { ok:r.ok, status:r.status, text:text||"", json:()=>text?JSON.parse(text):{} };
}

async function getProds() {
  if (rCache && Date.now()-rCacheTime < CACHE_TTL) return rCache;
  let items = [];

  try {
    const r = await rekazFetch(`${REKAZ_API}/products?maxResultCount=200`);
    if (r.ok) {
      const d = r.json();
      (d.items||[]).forEach(p => {
        if (!items.find(x => x.id === p.id)) items.push(p);
      });
    }
  } catch(e) {}

  try {
    const r = await rekazFetch(`${REKAZ_API}/products?type=3&maxResultCount=200`);
    if (r.ok) {
      const d = r.json();
      (d.items||[]).forEach(p => {
        if (!items.find(x => x.id === p.id)) items.push(p);
      });
    }
  } catch(e) {}

  rCache = { items }; rCacheTime = Date.now();
  return rCache;
}

async function refreshProds() { rCacheTime = 0; return getProds(); }

function adminAuth(req, res, next) {
  if ((req.headers.authorization||"").replace("Bearer ","") !== ADMIN_PASS)
    return res.status(401).json({ error:"Unauthorized" });
  next();
}

// ── PUBLIC ──
app.get("/", (req,res) => res.send("GRAFF SPA API ✅"));

app.get("/admin", async(req,res) => {
  try {
    const html = readFileSync(process.cwd()+"/admin.html","utf8");
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.status(500).send("admin.html not found: "+e.message);
  }
});

app.get("/site", async(req,res) => {
  const db = await readDB();
  res.json({
    theme:    db.theme,
    layout:   db.layout,
    texts:    db.texts,
    social:   db.social,
    buttons:  db.buttons.filter(b=>b.visible!==false).sort((a,b)=>a.order-b.order),
    payments: db.payments.filter(p=>p.visible!==false).sort((a,b)=>a.order-b.order),
    pages:    db.pages,
    policies: db.policies||{ar:"",en:""},
    // ✅ جديد: إرسال إعدادات الإهداء والعضوية
    giftConfig: db.giftConfig,
    membershipConfig: db.membershipConfig
  });
});

// ── MENU ──
app.get("/menu", async (req,res) => {
  try {
    const db = await readDB();
    const data = await getProds();
    const items = data.items || [];
    const byPriceId = {}, byProductId = {};
    items.forEach(p => {
      byProductId[p.id] = p;
      (p.pricing||[]).forEach(pr => { byPriceId[pr.id] = {product:p, pricing:pr}; });
      if (!p.pricing?.length) byPriceId[p.id] = {product:p, pricing:null};
    });

    const cats = db.categories
      .filter(c => c.visible !== false)
      .sort((a,b) => a.order - b.order)
      .map(cat => {
        const svcs = db.services
          .filter(s => s.categoryId === cat.id && s.visible !== false)
          .sort((a,b) => a.order - b.order)
          .reduce((acc, s) => {
            const rd = byPriceId[s.rekazPriceId] || (s.rekazProductId ? {product:byProductId[s.rekazProductId],pricing:null} : null);
            if (!rd?.product) return acc;
            const p = rd.product;
            const pid = p.id;
            let existing = acc.find(x => x.rekazProductId === pid);
            if (!existing) {
              existing = {
                id: s.id,
                rekazProductId: pid,
                rekazPriceId: s.rekazPriceId,
                nameAr: (p.nameAr || p.name || "").split(" - ")[0].trim(),
                description: (p.description || p.shortDescription || ""),
                options: [],
                addOns: (p.addOns || []).map(ao => {
                  const aoName = (
                    ao.label ||
                    (ao.localizedLabel?.OtherLanguages?.ar) ||
                    ""
                  ).trim();
                  if (!aoName) return null;
                  const customFieldKey = ao.immutableId || ao.id;
                  return { id: customFieldKey, nameAr: aoName, amount: ao.amount || 0 };
                }).filter(Boolean)
              };
              acc.push(existing);
            }
            if (rd.pricing) {
              const rawName = rd.pricing.nameAr || rd.pricing.name || "";
              const sep = rawName.includes(" – ") ? " – " : rawName.includes(" - ") ? " - " : null;
              const nameAr = sep ? rawName.split(sep)[0].trim() : rawName.trim();
              const nameEn = sep ? rawName.split(sep).slice(1).join(sep).trim() : "";
              existing.options.push({
                id: rd.pricing.id,
                nameAr,
                nameEn,
                amount: rd.pricing.amount,
                duration: rd.pricing.duration ?? 0
              });
            } else if (!existing.options.length) {
              existing.options.push({
                id: s.rekazPriceId || pid,
                nameAr: "",
                nameEn: "",
                amount: p.amount || 0,
                duration: p.duration ?? 0
              });
            }
            return acc;
          }, []);
        return {
          id: cat.id, nameAr: cat.nameAr, nameEn: cat.nameEn||"",
          subSections: cat.subSections || [],
          services: svcs
        };
      }).filter(c => c.services.length > 0);

    res.json({ categories: cats });
  } catch(e) {
    console.error("[/menu]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── SLOTS ──
app.get("/slots", async (req,res) => {
  try {
    const q = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${REKAZ_API}/reservations/slots?${q}`);
    res.status(r.status).send(r.text);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── OTP ──
app.post("/send-otp", async(req,res) => {
  const {phone}=req.body;
  if(!phone) return res.status(400).json({error:"Phone required"});
  const otp=Math.floor(1000+Math.random()*9000).toString();
  otpStore[phone]={otp,expires:Date.now()+5*60*1000,verified:false};
  console.log(`[OTP] ${phone}: ${otp}`);
  res.json({success:true,debug_otp:otp});
});

app.post("/verify-otp", async(req,res) => {
  const {phone,otp}=req.body;
  const s=otpStore[phone];
  if(!s) return res.status(400).json({error:"أرسلي رمزاً جديداً"});
  if(Date.now()>s.expires){delete otpStore[phone];return res.status(400).json({error:"انتهت صلاحية الرمز"});}
  if(s.otp!==otp.toString()) return res.status(400).json({error:"الرمز غير صحيح"});
  otpStore[phone].verified=true;
  res.json({success:true});
});

// ── CUSTOMER ──
app.post("/create-customer", async (req,res) => {
  const {name,phone}=req.body;
  if(!name||!phone) return res.status(400).json({error:"Name and phone required"});
  const s=otpStore[phone];
  if(!s?.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
  try {
    const mobile=phone.startsWith("+966")?phone:"+966"+phone.replace(/^0/,"");
    const chk=await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if(chk.ok){const d=chk.json();if(d.items?.length)return res.json({customerId:d.items[0].id});}
    const r=await rekazFetch(`${REKAZ_API}/customers`,{method:"POST",body:JSON.stringify({name,mobileNumber:mobile,type:1})});
    if(!r.ok) return res.status(r.status).json({error:"فشل إنشاء العميل"});
    res.json({customerId:r.json()});
  } catch(e){res.status(500).json({error:e.message});}
});

// ── BOOKING ──
app.post("/create-booking", async (req,res) => {
  const {customerId,phone,items,addons}=req.body;
  const bookingItems = items && items.length ? items : [{
    priceId: req.body.priceId,
    from: req.body.from,
    to: req.body.to
  }];
  if(!customerId||!bookingItems.length||!bookingItems[0].priceId||!bookingItems[0].from)
    return res.status(400).json({error:"Missing fields"});
  if(phone){
    const s=otpStore[phone];
    if(s && !s.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
  }
  try {
    const addOnList = (addons||[]).filter(a=>a.id);
    const customFields = {};
    addOnList.forEach(a => { customFields[a.id] = "true"; });

    const rekazItems = bookingItems.map((item, idx) => ({
      priceId: item.priceId,
      quantity: 1,
      from: item.from,
      to: item.to,
      ...(idx === 0 && Object.keys(customFields).length ? {customFields} : {})
    }));

    console.log("[Booking] items:", rekazItems.length);

    const r = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
      method: "POST",
      body: JSON.stringify({ customerId, branchId: BRANCH_ID, items: rekazItems })
    });
    if(!r.ok){
      console.log("[Booking] FAILED:", r.text);
      return res.status(r.status).json({error:"فشل الحجز", details:r.text});
    }
    console.log("[Booking] SUCCESS:", r.text.slice(0,300));
    const result = r.json();
    if(phone) delete otpStore[phone];
    const payPath = result.paymentLink || "";
    const payUrl = payPath ? (payPath.startsWith("http") ? payPath : `${REKAZ_BASE}${payPath}`) : null;
    res.json({success:true, payUrl, orderRef: result.number||result.id||null});
  } catch(e){res.status(500).json({error:e.message});}
});

// ── ADMIN: LOGIN ──
app.post("/admin/login",async(req,res)=>{
  if(req.body.password===ADMIN_PASS) res.json({success:true,token:ADMIN_PASS});
  else res.status(401).json({error:"كلمة المرور غير صحيحة"});
});

// ── ADMIN: DB ──
app.get("/admin/db",adminAuth,async(req,res)=>res.json(await readDB()));
app.put("/admin/db",adminAuth,async(req,res)=>{
  try{await writeDB(req.body);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});

// ✅ جديد: Gift Config
app.get("/admin/gift-config", adminAuth, async(req,res) => {
  const db = await readDB();
  res.json(db.giftConfig || { productId: null, priceIds: {} });
});

app.put("/admin/gift-config", adminAuth, async(req,res) => {
  try {
    const db = await readDB();
    db.giftConfig = req.body;
    await writeDB(db);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ جديد: Membership Config
app.get("/admin/membership-config", adminAuth, async(req,res) => {
  const db = await readDB();
  res.json(db.membershipConfig || { productId: null, priceId: null });
});

app.put("/admin/membership-config", adminAuth, async(req,res) => {
  try {
    const db = await readDB();
    db.membershipConfig = req.body;
    await writeDB(db);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: CATEGORIES ──
app.get("/admin/categories",adminAuth,async(req,res)=>{
  const db = await readDB();
  res.json(db.categories);
});

app.post("/admin/categories",adminAuth,async(req,res)=>{
  const db=await readDB();
  const cat={
    id:"cat_"+uid(), nameAr:req.body.nameAr||"قسم جديد", nameEn:req.body.nameEn||"",
    subSections: req.body.subSections||[],
    order:db.categories.length+1, visible:true
  };
  db.categories.push(cat); await writeDB(db); res.json(cat);
});

app.put("/admin/categories/:id",adminAuth,async(req,res)=>{
  const db=await readDB(); const i=db.categories.findIndex(c=>c.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Not found"});
  db.categories[i]={...db.categories[i],...req.body,id:req.params.id};
  await writeDB(db); res.json(db.categories[i]);
});

app.delete("/admin/categories/:id",adminAuth,async(req,res)=>{
  const db=await readDB();
  db.categories=db.categories.filter(c=>c.id!==req.params.id);
  db.services=db.services.filter(s=>s.categoryId!==req.params.id);
  await writeDB(db); res.json({success:true});
});

// ✅ جديد: ترتيب الأقسام
app.put("/admin/categories-order",adminAuth,async(req,res)=>{
  const db=await readDB();
  (req.body.order||[]).forEach((id,idx)=>{
    const i=db.categories.findIndex(c=>c.id===id);
    if(i>=0) db.categories[i].order=idx+1;
  });
  await writeDB(db); res.json({success:true});
});

app.put("/admin/categories/:id/services",adminAuth,async(req,res)=>{
  const db=await readDB(); const catId=req.params.id;
  
  // ✅ منع التكرار: استخدام ID بدل الاسم
  const existingServices = db.services.filter(s => s.categoryId === catId);
  const newPriceIds = (req.body.priceIds || []).map(item => item.rekazPriceId);
  
  // تحديث الخدمات الموجودة
  existingServices.forEach(svc => {
    const updated = (req.body.priceIds || []).find(item => item.rekazPriceId === svc.rekazPriceId);
    if (updated) {
      Object.assign(svc, updated);
    }
  });
  
  // حذف الخدمات المحذوفة
  db.services = db.services.filter(s => 
    s.categoryId !== catId || newPriceIds.includes(s.rekazPriceId)
  );
  
  // إضافة الخدمات الجديدة
  (req.body.priceIds || []).forEach((item, idx) => {
    if (!existingServices.find(s => s.rekazPriceId === item.rekazPriceId)) {
      db.services.push({
        id: "srv_" + uid(),
        rekazPriceId: item.rekazPriceId,
        rekazProductId: item.rekazProductId || null,
        categoryId: catId,
        nameAr: item.nameAr || "",
        order: idx + 1,
        visible: true
      });
    }
  });
  
  await writeDB(db);
  res.json({ success: true, count: newPriceIds.length });
});

app.get("/admin/rekaz-products",adminAuth,async(req,res)=>{
  try{res.json(await getProds());}catch(e){res.status(500).json({error:e.message});}
});

// ── GIFT PAGE ──
app.get("/gift",async(req,res)=>{
  try{const html=readFileSync(process.cwd()+"/gift.html","utf8");res.setHeader("Content-Type","text/html; charset=utf-8");res.send(html);}
  catch(e){res.status(404).send("gift.html not found");}
});

// ── MEMBERSHIP PAGE ──
app.get("/membership",async(req,res)=>{
  try{const html=readFileSync(process.cwd()+"/membership.html","utf8");res.setHeader("Content-Type","text/html; charset=utf-8");res.send(html);}
  catch(e){res.status(404).send("membership.html not found");}
});

// ✅ جديد: GIFT PURCHASE (بدون slots/datetime)
app.post("/gift/purchase", async (req, res) => {
  const { amount, fromName, fromPhone, toName, toPhone, message, showSender } = req.body;
  
  if (!amount || !fromName || !fromPhone || !toName || !toPhone) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }
  
  try {
    const db = await readDB();
    const giftConfig = db.giftConfig || {};
    
    if (!giftConfig.productId || !giftConfig.priceIds) {
      return res.status(400).json({ error: "إعدادات الإهداء غير مكتملة في لوحة التحكم" });
    }
    
    const priceId = giftConfig.priceIds[String(amount)];
    if (!priceId) {
      return res.status(400).json({ error: `لا توجد فئة إهداء بمبلغ ${amount} ريال` });
    }
    
    const fromMobile = fromPhone.startsWith("+966") ? fromPhone : "+966" + fromPhone.replace(/^0/, "");
    const orderRef = "GIFT-" + Date.now().toString(36).toUpperCase();
    
    let customerId = null;
    try {
      const chk = await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(fromMobile)}`);
      if (chk.ok) {
        const cd = chk.json();
        if (cd.items && cd.items.length) customerId = cd.items[0].id;
      }
    } catch(e) {}
    
    const payload = {
      items: [{ priceId, quantity: 1 }],
      invoiceNote: `Gift to: ${toName} (${toPhone})${message ? ` — "${message}"` : ""}`,
      branchId: BRANCH_ID,
      ...(customerId
        ? { customerId }
        : { customerDetails: { name: fromName, mobileNumber: fromMobile, type: 1 } })
    };
    
    const r = await rekazFetch(`${REKAZ_API}/subscriptions`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    let payUrl = null;
    let invoiceId = null;
    
    if (r.ok) {
      const d = r.json();
      invoiceId = d.invoiceId || d.id || null;
      const pp = d.paymentLink || d.payUrl || "";
      payUrl = pp ? (pp.startsWith("http") ? pp : `${REKAZ_BASE}${pp}`)
                  : (invoiceId ? `${REKAZ_BASE}/i/${invoiceId}` : null);
    }
    
    if (!db.giftOrders) db.giftOrders = [];
    db.giftOrders.unshift({
      ref: orderRef,
      invoiceId,
      amount,
      fromName,
      fromPhone,
      toName,
      toPhone,
      message: message || "",
      showSender: !!showSender,
      createdAt: new Date().toISOString(),
      status: payUrl ? "pending_payment" : "rekaz_failed"
    });
    await writeDB(db);
    
    res.json({ success: true, orderRef, invoiceId, payUrl });
  } catch(e) {
    console.error("[Gift Purchase]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ✅ جديد: MEMBERSHIP PURCHASE (بدون slots/datetime)
app.post("/membership/purchase", async (req, res) => {
  const { planName, name, phone, email } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: "الاسم ورقم الجوال مطلوبان" });
  }
  
  try {
    const db = await readDB();
    const memConfig = db.membershipConfig || {};
    
    if (!memConfig.productId || !memConfig.priceId) {
      return res.status(400).json({ error: "إعدادات العضوية غير مكتملة في لوحة التحكم" });
    }
    
    const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");
    const orderRef = "MEM-" + Date.now().toString(36).toUpperCase();
    
    const payload = {
      customerDetails: {
        name,
        mobileNumber: mobile,
        email: email || undefined,
        type: 1
      },
      branchId: BRANCH_ID,
      items: [{ priceId: memConfig.priceId, quantity: 1 }]
    };
    
    const r = await rekazFetch(`${REKAZ_API}/subscriptions`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    let payUrl = null;
    let invoiceId = null;
    
    if (r.ok) {
      const result = r.json();
      invoiceId = result.invoiceId || result.id || null;
      const pp = result.paymentLink || result.payUrl || "";
      payUrl = pp ? (pp.startsWith("http") ? pp : `${REKAZ_BASE}${pp}`)
                  : (invoiceId ? `${REKAZ_BASE}/i/${invoiceId}` : null);
    }
    
    if (!db.membershipOrders) db.membershipOrders = [];
    db.membershipOrders.unshift({
      ref: orderRef,
      invoiceId,
      planName: planName || "Elite Membership",
      name,
      phone: mobile,
      email: email || "",
      createdAt: new Date().toISOString(),
      status: payUrl ? "pending_payment" : "rekaz_failed"
    });
    await writeDB(db);
    
    res.json({ success: true, orderRef, invoiceId, payUrl });
  } catch(e) {
    console.error("[Membership Purchase]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: ORDERS ──
app.get("/admin/gift-orders", adminAuth, async(req, res) => {
  const db = await readDB();
  res.json(db.giftOrders || []);
});

app.get("/admin/membership-orders", adminAuth, async(req, res) => {
  const db = await readDB();
  res.json(db.membershipOrders || []);
});

const PORT=process.env.PORT||3000;
async function startServer(){
  console.log("[Startup] Loading DB from Supabase...");
  try{
    const db=await readDB();
    console.log("[Startup] DB ready ✓ cats:",(db.categories||[]).length);
  }catch(e){console.log("[Startup] DB load error:",e.message);}
  app.listen(PORT,()=>{
    console.log(`[GRAFF SPA] Server on port ${PORT}`);
  });
}
startServer();
