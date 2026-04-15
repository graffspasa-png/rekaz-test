import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const DEFAULT_DB = {
  categories: [],
  services: [],
  addonsMap: {},
  questions: [
    { id: "allergy", label: "هل لديك حساسية من أي مواد؟", type: "checkbox", required: false, visible: true, fixed: true },
    { id: "allergy_detail", label: "تفاصيل الحساسية", type: "text", placeholder: "يرجى ذكر نوع الحساسية...", required: false, visible: true, conditional: "allergy", fixed: true },
    { id: "notes", label: "ملاحظات إضافية", type: "textarea", placeholder: "أي طلبات خاصة أو ملاحظات تودين إضافتها...", required: false, visible: true, fixed: true }
  ],
  policies: {
    ar: "السياسات العامة:\n• يمكن تعديل الموعد أو تغيير وقته فقط في حال توفر إمكانية في نفس يوم الموعد، فيما عدا ذلك، الموعد غير قابل للتعديل بعد الحجز.\n• في حال التأخر 15 دقيقة، يتم إلغاء الموعد تلقائياً.\n• عند إلغاء الموعد قبل 4 ساعات من وقت الخدمة، يتم إضافة المبلغ كرصيد في حسابك بصلاحية شهرين.\n• في حال عدم الحضور أو الإلغاء قبل أقل من 4 ساعات، يكون المبلغ غير قابل للاسترجاع.\n\nسياسات القسائم (الفاوتشر):\n• عند الحجز باستخدام قسيمة، يجب إبلاغنا قبل 4 ساعات في حال الرغبة بإلغاء الموعد أو تغييره.\n• في حال عدم الحضور بدون إشعار مسبق، تصبح القسيمة غير صالحة ولا يمكن استخدامها مرة أخرى.\n• في حال التأخر 15 دقيقة، يتم إلغاء الموعد ويعتبر الفاوتشر غير صالح.",
    en: "General Policies:\n• Appointments can only be rescheduled if availability exists on the same day. Otherwise, appointments are non-modifiable after booking.\n• A 15-minute late arrival results in automatic cancellation.\n• Cancellations made 4+ hours before service time will be added as credit valid for 2 months.\n• No-shows or cancellations less than 4 hours before service are non-refundable.\n\nVoucher Policies:\n• Voucher bookings require 4-hour advance notice for cancellations or changes.\n• No-shows without prior notice render the voucher invalid.\n• 15-minute late arrivals result in cancellation and voucher invalidation."
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
    gift: { title:"بطاقة الإهداء", subtitle:"اهدي تجربة لا تُنسى", amounts:[200,300,500,1000], sections:[] },
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
  for (const p of DISK_PATHS) {
    try {
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, "utf8"));
        MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
        return MEM_DB;
      }
    } catch(e) { console.log(`Read ${p} failed:`, e.message); }
  }
  if (MEM_DB) return MEM_DB;
  if (process.env.INITIAL_DB) {
    try {
      const raw = JSON.parse(Buffer.from(process.env.INITIAL_DB, "base64").toString());
      MEM_DB = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
      return MEM_DB;
    } catch(e) {}
  }
  MEM_DB = JSON.parse(JSON.stringify(DEFAULT_DB));
  return MEM_DB;
}

function writeDB(db) {
  MEM_DB = db;
  for (const p of DISK_PATHS) {
    try {
      const dir = p.substring(0, p.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, JSON.stringify(db, null, 2), "utf8");
      console.log(`[DB] Saved to ${p}`);
      return;
    } catch(e) { console.log(`Write ${p} failed:`, e.message); }
  }
  console.warn("[DB] WARNING: Add Render Disk at /var/data for persistence!");
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
  const r = await rekazFetch(`${REKAZ_API}/products`);
  if (!r.ok) throw new Error("Rekaz products failed");
  rCache = r.json(); rCacheTime = Date.now();
  return rCache;
}

function adminAuth(req,res,next) {
  if((req.headers.authorization||"").replace("Bearer ","")!==ADMIN_PASS)
    return res.status(401).json({error:"Unauthorized"});
  next();
}

// ── PUBLIC ──
app.get("/", (req,res) => res.send("GRAFF SPA API ✅"));

app.get("/admin", (req,res) => {
  try { res.send(readFileSync(join(__dirname,"admin.html"),"utf8")); }
  catch(e) { res.status(404).send("admin.html not found — upload it to the server root folder"); }
});

app.get("/site", (req,res) => {
  const db = readDB();
  res.json({
    theme: db.theme,
    layout: db.layout,
    texts: db.texts,
    social: db.social,
    buttons: db.buttons.filter(b=>b.visible!==false).sort((a,b)=>a.order-b.order),
    payments: db.payments.filter(p=>p.visible!==false).sort((a,b)=>a.order-b.order),
    pages: db.pages,
    policies: db.policies,
    questions: (db.questions||[]).filter(q=>q.visible!==false)
  });
});

// ── MENU ──
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
                description: p.description || p.shortDescription || "",
                options: [],
                addOns: (p.addOns||[]).map(ao=>{
                  const aoName=(ao.label||(ao.localizedLabel?.OtherLanguages?.ar)||"").trim();
                  if(!aoName) return null;
                  return { id: ao.immutableId||ao.id, nameAr:aoName, amount:ao.amount||0 };
                }).filter(Boolean),
                mappedAddons: (db.addonsMap||{})[pid] || []
              };
              acc.push(existing);
            }
            if (rd.pricing) {
              const rawName = rd.pricing.nameAr || rd.pricing.name || "";
              const sep = rawName.includes(" – ") ? " – " : rawName.includes(" - ") ? " - " : null;
              const nameAr = sep ? rawName.split(sep)[0].trim() : rawName.trim();
              const nameEn = sep ? rawName.split(sep).slice(1).join(sep).trim() : "";
              existing.options.push({ id:rd.pricing.id, nameAr, nameEn, amount:rd.pricing.amount, duration:rd.pricing.duration||p.duration||0 });
            } else if (!existing.options.length) {
              existing.options.push({ id:s.rekazPriceId||pid, nameAr:"", nameEn:"", amount:p.amount||0, duration:p.duration||0 });
            }
            return acc;
          }, []);
        return { id:cat.id, nameAr:cat.nameAr, nameEn:cat.nameEn||"", subSections:cat.subSections||[], services:svcs };
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
app.post("/send-otp", (req,res) => {
  const {phone}=req.body;
  if(!phone) return res.status(400).json({error:"Phone required"});
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
  const {customerId,phone,priceId,from,to,addons,answers}=req.body;
  if(!customerId||!priceId||!from||!to) return res.status(400).json({error:"Missing fields"});
  if(phone){const s=otpStore[phone];if(s&&!s.verified)return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});}
  try {
    // Build customFields from answers
    const customFields = {};
    if(answers && typeof answers==="object") {
      Object.entries(answers).forEach(([k,v])=>{ if(v) customFields[`q_${k}`]=String(v); });
    }
    // Rekaz addons (immutableId)
    (addons||[]).filter(a=>a.id&&!a.priceId).forEach(a=>{ customFields[a.id]="true"; });

    // Main service item
    const items = [{ priceId, quantity:1, from, to, customFields }];

    // Mapped addons = separate priceId items
    (addons||[]).filter(a=>a.priceId).forEach(a=>{
      items.push({ priceId:a.priceId, quantity:1, from, to });
    });

    const payload = { customerId, branchId:BRANCH_ID, items };
    console.log("[Booking] payload:", JSON.stringify(payload, null, 2));

    const r = await rekazFetch(`${REKAZ_API}/reservations/bulk`,{method:"POST",body:JSON.stringify(payload)});
    if(!r.ok){console.log("[Booking] FAILED:", r.text);return res.status(r.status).json({error:"فشل الحجز",details:r.text});}
    console.log("[Booking] SUCCESS:", r.text.slice(0,300));
    const result = r.json();
    if(phone) delete otpStore[phone];
    const payPath = result.paymentLink||"";
    const payUrl = payPath?(payPath.startsWith("http")?payPath:`${REKAZ_BASE}${payPath}`):null;
    res.json({success:true, payUrl});
  } catch(e){res.status(500).json({error:e.message});}
});

// ── ADMIN ──
app.post("/admin/login",(req,res)=>{
  if(req.body.password===ADMIN_PASS) res.json({success:true,token:ADMIN_PASS});
  else res.status(401).json({error:"كلمة المرور غير صحيحة"});
});
app.get("/admin/db",adminAuth,(req,res)=>res.json(readDB()));
app.put("/admin/db",adminAuth,(req,res)=>{
  try{writeDB(req.body);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get("/admin/db-export",adminAuth,(req,res)=>{
  const db=readDB();
  res.json({base64:Buffer.from(JSON.stringify(db)).toString("base64"),hint:"Set INITIAL_DB env var"});
});
app.get("/admin/categories",adminAuth,(req,res)=>res.json(readDB().categories));
app.post("/admin/categories",adminAuth,(req,res)=>{
  const db=readDB();
  const cat={id:"cat_"+uid(),nameAr:req.body.nameAr||"قسم جديد",nameEn:req.body.nameEn||"",subSections:req.body.subSections||[],order:db.categories.length+1,visible:true};
  db.categories.push(cat);writeDB(db);res.json(cat);
});
app.put("/admin/categories/:id",adminAuth,(req,res)=>{
  const db=readDB();const i=db.categories.findIndex(c=>c.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Not found"});
  db.categories[i]={...db.categories[i],...req.body,id:req.params.id};
  writeDB(db);res.json(db.categories[i]);
});
app.delete("/admin/categories/:id",adminAuth,(req,res)=>{
  const db=readDB();
  db.categories=db.categories.filter(c=>c.id!==req.params.id);
  db.services=db.services.filter(s=>s.categoryId!==req.params.id);
  writeDB(db);res.json({success:true});
});
app.put("/admin/categories-order",adminAuth,(req,res)=>{
  const db=readDB();
  (req.body.order||[]).forEach((id,idx)=>{const i=db.categories.findIndex(c=>c.id===id);if(i>=0)db.categories[i].order=idx+1;});
  writeDB(db);res.json({success:true});
});
app.put("/admin/categories/:id/services",adminAuth,(req,res)=>{
  const db=readDB();const catId=req.params.id;
  db.services=db.services.filter(s=>s.categoryId!==catId);
  (req.body.priceIds||[]).forEach((item,idx)=>{
    db.services.push({id:"srv_"+uid(),rekazPriceId:item.rekazPriceId,rekazProductId:item.rekazProductId||null,categoryId:catId,nameAr:item.nameAr||"",order:idx+1,visible:true});
  });
  writeDB(db);res.json({success:true,count:(req.body.priceIds||[]).length});
});
app.get("/admin/rekaz-products",adminAuth,async(req,res)=>{
  try{res.json(await getProds());}catch(e){res.status(500).json({error:e.message});}
});
app.get("/admin/addons-map",adminAuth,(req,res)=>res.json(readDB().addonsMap||{}));
app.put("/admin/addons-map",adminAuth,(req,res)=>{
  const db=readDB();db.addonsMap=req.body;writeDB(db);res.json({success:true});
});
app.get("/admin/questions",adminAuth,(req,res)=>res.json(readDB().questions||[]));
app.put("/admin/questions",adminAuth,(req,res)=>{
  const db=readDB();db.questions=req.body;writeDB(db);res.json({success:true});
});
app.get("/admin/policies",adminAuth,(req,res)=>res.json(readDB().policies||{}));
app.put("/admin/policies",adminAuth,(req,res)=>{
  const db=readDB();db.policies=req.body;writeDB(db);res.json({success:true});
});

// ── DEBUG ──
app.get("/debug-rekaz",async(req,res)=>{
  try{const data=await getProds();res.json(data);}catch(e){res.status(500).json({error:e.message});}
});
app.get("/debug-product/:id",async(req,res)=>{
  try{const r=await rekazFetch(`${REKAZ_API}/products/${req.params.id}`);res.send(r.text);}catch(e){res.status(500).send(e.message);}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`[GRAFF SPA] Server on port ${PORT}`);
  readDB();
});
