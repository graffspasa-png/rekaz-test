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

// ── Persistent Storage Strategy ──
// Primary: /var/data (Render persistent disk if mounted)
// Fallback: /tmp (resets on restart — Render free tier)
// Backup: process memory (survives sleep but not restart)
// Recovery: INITIAL_DB env var (base64 encoded, set manually for disaster recovery)
const DISK_PATHS = ["/var/data/graff_db.json", "/tmp/graff_db.json"];
let MEM_DB = null; // in-memory backup

const DEFAULT_DB = {
  categories: [],
  services: [],
  texts: {
    // All editable texts in one place
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
    btn4Text: "تواصلي معنا"
  },
  theme: {
    primaryColor:"#b8965a", primaryHover:"#c8a66a",
    bgDark:"#080807", bgDark2:"#0c0b09",
    bgLight:"#f3ede3", textColor:"#17150e",
    mutedColor:"#78706a", borderColor:"#d8d0c0",
    fontArabic:"Tajawal", fontDisplay:"Cormorant Garamond",
    borderRadius:0, logoAccent:"#b8965a"
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
  pages: {
    gift: {
      title:"بطاقة الإهداء", subtitle:"اهدي تجربة لا تُنسى",
      amounts:[200,300,500,1000], sections:[]
    },
    memberships: { items:[
      {name:"Classic",price:4000,featured:false,visits:12,features:["مناكير روسي كامل","علاج فيشيال للبشرة","12 زيارة / 12 شهراً"]},
      {name:"VIP",price:8000,featured:true,visits:12,features:["جل اكستنشن أو بياب","مناكير روسي","علاج فيشيال","12 زيارة / 12 شهراً"]},
      {name:"V-VIP",price:10000,featured:false,visits:12,features:["كل مميزات VIP","رموش كلاسيك","30 دقيقة مساج","12 زيارة / 12 شهراً"]}
    ]}
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

function readDB() {
  // 1. Try persistent paths
  for (const p of DISK_PATHS) {
    try {
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, "utf8"));
        MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
        return MEM_DB;
      }
    } catch(e) { console.log(`Read ${p} failed:`, e.message); }
  }
  // 2. Use memory backup if available
  if (MEM_DB) return MEM_DB;
  // 3. Try env var recovery
  if (process.env.INITIAL_DB) {
    try {
      const raw = JSON.parse(Buffer.from(process.env.INITIAL_DB, "base64").toString());
      MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
      return MEM_DB;
    } catch(e) {}
  }
  // 4. Default
  MEM_DB = JSON.parse(JSON.stringify(DEFAULT_DB));
  return MEM_DB;
}

function writeDB(db) {
  MEM_DB = db; // Always keep in memory
  // Try to write to disk
  for (const p of DISK_PATHS) {
    try {
      const dir = p.substring(0, p.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, JSON.stringify(db, null, 2), "utf8");
      console.log(`[DB] Saved to ${p}`);
      return;
    } catch(e) { console.log(`Write ${p} failed:`, e.message); }
  }
  console.warn("[DB] WARNING: Could not save to disk! Data in memory only.");
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Rekaz cache
let rCache = null, rCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;
const otpStore = {};

async function rekazFetch(url, opts = {}) {
  console.log(`[Rekaz] ${opts.method||"GET"} ${url}`);
  const r = await fetch(url, { ...opts, headers: { ...RH(), ...(opts.headers||{}) } });
  const text = await r.text();
  console.log(`[Rekaz] ${r.status}: ${text.slice(0,200)}`);
  if (!text) throw new Error("Empty Rekaz response");
  return { ok:r.ok, status:r.status, text, json:()=>JSON.parse(text) };
}
async function getProds() {
  if (rCache && Date.now()-rCacheTime < CACHE_TTL) return rCache;
  const r = await rekazFetch(`${REKAZ_API}/products`);
  if (!r.ok) throw new Error("Rekaz products failed");
  rCache = r.json(); rCacheTime = Date.now();
  return rCache;
}

function auth(req, res, next) {
  if ((req.headers.authorization||"").replace("Bearer ","") !== ADMIN_PASS)
    return res.status(401).json({ error:"Unauthorized" });
  next();
}

// ── PUBLIC ──
app.get("/", (req,res) => res.send("GRAFF SPA API ✅"));

// Full site data for frontend
app.get("/site", (req,res) => {
  const db = readDB();
  res.json({
    theme:    db.theme,
    layout:   db.layout,
    texts:    db.texts,
    social:   db.social,
    buttons:  db.buttons.filter(b=>b.visible!==false).sort((a,b)=>a.order-b.order),
    payments: db.payments.filter(p=>p.visible!==false).sort((a,b)=>a.order-b.order),
    pages:    db.pages
  });
});

// Booking menu: categories + services merged with Rekaz
app.get("/menu", async (req,res) => {
  try {
    const db = readDB();
    const data = await getProds();
    const items = data.items || [];
    const byPriceId = {}, byProductId = {};
    items.forEach(p => {
      byProductId[p.id] = p;
      (p.pricing||[]).forEach(pr => { byPriceId[pr.id] = {product:p, pricing:pr}; });
      if (!p.pricing?.length) byPriceId[p.id] = {product:p, pricing:null};
    });
    // Group db.services by rekazProductId → one entry per product with all its pricing options
    // Step 1: build a map productId → {product, dbService, pricingOptions[]}
    const productMap = {};
    const productOrder = [];
    db.services
      .filter(s => s.categoryId !== undefined) // will be filtered per-cat below
      .forEach(s => {
        const rd = byPriceId[s.rekazPriceId] || (s.rekazProductId ? {product:byProductId[s.rekazProductId],pricing:null} : null);
        if (!rd?.product) return;
        const p = rd.product;
        const pid = p.id;
        if (!productMap[pid]) {
          productMap[pid] = {
            rekazProductId: pid,
            dbService: s,
            product: p,
            pricingOptions: [],
            addOns: [],
            categoryId: s.categoryId,
            order: s.order,
            visible: s.visible
          };
          productOrder.push(pid);
        }
        const pm = productMap[pid];
        // Add this pricing option
        if (rd.pricing) {
          pm.pricingOptions.push({
            id: rd.pricing.id,
            nameAr: rd.pricing.nameAr || rd.pricing.name || "",
            amount: rd.pricing.amount,
            duration: rd.pricing.duration || p.duration || 0
          });
        } else if (!pm.pricingOptions.length) {
          // No specific pricing — use product directly as single option
          pm.pricingOptions.push({
            id: s.rekazPriceId || pid,
            nameAr: "",
            amount: p.amount || 0,
            duration: p.duration || 0
          });
        }
        // Merge add-ons (unique by id, resolve name from rekaz)
        (p.addOns || []).forEach(ao => {
          if (!pm.addOns.find(x => x.id === ao.id)) {
            const aoName = (ao.nameAr || ao.name || "").trim();
            if (aoName) pm.addOns.push({ id: ao.id, nameAr: aoName, amount: ao.amount || 0 });
          }
        });
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
            // Check if we already added this product to this category
            let existing = acc.find(x => x.rekazProductId === pid);
            if (!existing) {
              existing = {
                id: s.id,
                rekazProductId: pid,
                rekazPriceId: s.rekazPriceId,
                nameAr: (p.nameAr || p.name || "").split(" - ")[0].trim(),
                description: (p.description || p.shortDescription || ""),
                options: [],
                addOns: (p.addOns || [])
                  .map(ao => {
                    const aoName = (ao.label || ao.name || ao.nameAr || "").trim();
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(aoName);
                    if (!aoName || isUUID) return null;
                    return { id: ao.id, nameAr: aoName, amount: ao.amount || 0 };
                  })
                  .filter(Boolean)
              };
              acc.push(existing);
            }
            // Add pricing option
            // Rekaz pricing name format: "بسيط - Minimal" — extract Arabic part only
            if (rd.pricing) {
              const pricingRawName = rd.pricing.nameAr || rd.pricing.name || "";
              // Handle both " - " and " – " separators from Rekaz
              const pricingSep = pricingRawName.includes(" – ") ? " – " : (pricingRawName.includes(" - ") ? " - " : null);
              const pricingNameAr = pricingSep ? pricingRawName.split(pricingSep)[0].trim() : pricingRawName.trim();
              const pricingNameEn = pricingSep ? pricingRawName.split(pricingSep).slice(1).join(pricingSep).trim() : "";
              existing.options.push({
                id: rd.pricing.id,
                nameAr: pricingNameAr,
                nameEn: pricingNameEn,
                amount: rd.pricing.amount,
                duration: rd.pricing.duration || p.duration || 0
              });
            } else if (!existing.options.length) {
              existing.options.push({
                id: s.rekazPriceId || pid,
                nameAr: "",
                amount: p.amount || 0,
                duration: p.duration || 0
              });
            }
            return acc;
          }, []);
        return {
          id:cat.id, nameAr:cat.nameAr, nameEn:cat.nameEn||"",
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

// Slots, OTP, Customer, Booking (unchanged)
app.get("/slots", async (req,res) => {
  try {
    const q = new URLSearchParams(req.query).toString();
    const r = await rekazFetch(`${REKAZ_API}/reservations/slots?${q}`);
    res.status(r.status).send(r.text);
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.post("/send-otp", (req,res) => {
  const {phone}=req.body; if(!phone) return res.status(400).json({error:"Phone required"});
  const otp=Math.floor(1000+Math.random()*9000).toString();
  otpStore[phone]={otp,expires:Date.now()+5*60*1000,verified:false};
  console.log(`[OTP] ${phone}: ${otp}`);
  res.json({success:true,debug_otp:otp});
});
app.post("/verify-otp", (req,res) => {
  const {phone,otp}=req.body;
  const s=otpStore[phone];
  if(!s) return res.status(400).json({error:"أرسلي رمزاً جديداً"});
  if(Date.now()>s.expires){delete otpStore[phone];return res.status(400).json({error:"انتهت صلاحية الرمز"});}
  if(s.otp!==otp.toString()) return res.status(400).json({error:"الرمز غير صحيح"});
  otpStore[phone].verified=true; res.json({success:true});
});
app.post("/create-customer", async (req,res) => {
  const {name,phone}=req.body;
  if(!name||!phone) return res.status(400).json({error:"Name and phone required"});
  const s=otpStore[phone]; if(!s?.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
  try {
    const mobile=phone.startsWith("+966")?phone:"+966"+phone.replace(/^0/,"");
    const chk=await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if(chk.ok){const d=chk.json();if(d.items?.length)return res.json({customerId:d.items[0].id});}
    const r=await rekazFetch(`${REKAZ_API}/customers`,{method:"POST",body:JSON.stringify({name,mobileNumber:mobile,type:1})});
    if(!r.ok) return res.status(r.status).json({error:"فشل إنشاء العميل"});
    res.json({customerId:r.json()});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post("/create-booking", async (req,res) => {
  const {customerId,phone,priceId,from,to}=req.body;
  if(!customerId||!priceId||!from||!to) return res.status(400).json({error:"Missing fields"});
  if(phone){
    const s=otpStore[phone];
    // Allow if: verified, or OTP was already consumed (s is undefined after delete)
    if(s && !s.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
    // If s is undefined — OTP was already used in create-customer, that's OK
  }
  try {
    const r=await rekazFetch(`${REKAZ_API}/reservations/bulk`,{
      method:"POST",
      body:JSON.stringify({customerDetails:null,customerId,branchId:BRANCH_ID,items:[{priceId,quantity:1,from,to}]})
    });
    if(!r.ok) return res.status(r.status).json({error:"فشل الحجز",details:r.text});
    const result=r.json();
    if(phone) delete otpStore[phone];
    const payPath=result.paymentLink||"";
    const payUrl=payPath?(payPath.startsWith("http")?payPath:`${REKAZ_BASE}${payPath}`):null;
    // Remove orderNumber — use payUrl only
    console.log(`[Booking] Pay:${payUrl}`);
    res.json({success:true, payUrl});
  } catch(e){res.status(500).json({error:e.message});}
});

// ── ADMIN ──
function adminAuth(req,res,next) {
  if((req.headers.authorization||"").replace("Bearer ","")!==ADMIN_PASS)
    return res.status(401).json({error:"Unauthorized"});
  next();
}
app.post("/admin/login",(req,res)=>{
  if(req.body.password===ADMIN_PASS) res.json({success:true,token:ADMIN_PASS});
  else res.status(401).json({error:"كلمة المرور غير صحيحة"});
});
app.get("/admin/db",adminAuth,(req,res)=>res.json(readDB()));
app.put("/admin/db",adminAuth,(req,res)=>{
  try{writeDB(req.body);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});
// Export DB as base64 (for env var backup)
app.get("/admin/db-export",adminAuth,(req,res)=>{
  const db=readDB();
  const b64=Buffer.from(JSON.stringify(db)).toString("base64");
  res.json({base64:b64,hint:"Set INITIAL_DB env var to this value for disaster recovery"});
});
app.get("/admin/categories",adminAuth,(req,res)=>res.json(readDB().categories));
app.post("/admin/categories",adminAuth,(req,res)=>{
  const db=readDB();
  const cat={
    id:"cat_"+uid(), nameAr:req.body.nameAr||"قسم جديد", nameEn:req.body.nameEn||"",
    subSections: req.body.subSections||[], // array of {name, serviceIds}
    order:db.categories.length+1, visible:true
  };
  db.categories.push(cat); writeDB(db); res.json(cat);
});
app.put("/admin/categories/:id",adminAuth,(req,res)=>{
  const db=readDB(); const i=db.categories.findIndex(c=>c.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Not found"});
  db.categories[i]={...db.categories[i],...req.body,id:req.params.id};
  writeDB(db); res.json(db.categories[i]);
});
app.delete("/admin/categories/:id",adminAuth,(req,res)=>{
  const db=readDB();
  db.categories=db.categories.filter(c=>c.id!==req.params.id);
  db.services=db.services.filter(s=>s.categoryId!==req.params.id);
  writeDB(db); res.json({success:true});
});
app.put("/admin/categories-order",adminAuth,(req,res)=>{
  const db=readDB();
  (req.body.order||[]).forEach((id,idx)=>{
    const i=db.categories.findIndex(c=>c.id===id);
    if(i>=0) db.categories[i].order=idx+1;
  });
  writeDB(db); res.json({success:true});
});
app.put("/admin/categories/:id/services",adminAuth,(req,res)=>{
  const db=readDB(); const catId=req.params.id;
  db.services=db.services.filter(s=>s.categoryId!==catId);
  (req.body.priceIds||[]).forEach((item,idx)=>{
    db.services.push({
      id:"srv_"+uid(), rekazPriceId:item.rekazPriceId,
      rekazProductId:item.rekazProductId||null,
      categoryId:catId, nameAr:item.nameAr||"",
      order:idx+1, visible:true
    });
  });
  writeDB(db); res.json({success:true,count:(req.body.priceIds||[]).length});
});
// ── DEBUG: raw Rekaz data (temporary) ──
app.get("/debug-rekaz",async(req,res)=>{
  try{const data=await getProds();res.json(data);}
  catch(e){res.status(500).json({error:e.message});}
});

app.get("/admin/rekaz-products",adminAuth,async(req,res)=>{
  try{res.json(await getProds());}catch(e){res.status(500).json({error:e.message});}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`[GRAFF SPA] Server on port ${PORT}`);
  readDB(); // Pre-load DB into memory on start
});
