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

const DEFAULT_DB = {
  categories: [],
  services: [],
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
    ar: "السياسات العامة:\n• يمكن تعديل الموعد أو تغيير وقته فقط في حال توفر إمكانية في نفس يوم الموعد، فيما عدا ذلك، الموعد غير قابل للتعديل بعد الحجز.\n• في حال التأخر 15 دقيقة، يتم إلغاء الموعد تلقائياً.\n• عند إلغاء الموعد قبل 4 ساعات من وقت الخدمة، يتم إضافة المبلغ كرصيد في حسابك بصلاحية شهرين.\n• في حال عدم الحضور أو الإلغاء قبل أقل من 4 ساعات، يكون المبلغ غير قابل للاسترجاع.\n\nسياسات القسائم:\n• عند الحجز باستخدام قسيمة، يجب إبلاغنا قبل 4 ساعات في حال الرغبة بإلغاء الموعد أو تغييره.\n• في حال عدم الحضور بدون إشعار مسبق، تصبح القسيمة غير صالحة.\n• في حال التأخر 15 دقيقة، يتم إلغاء الموعد ويعتبر الفاوتشر غير صالح.",
    en: ""
  },
  pages: {
    gift: {
      title:"بطاقة الإهداء", subtitle:"اهدي تجربة لا تُنسى لمن تحبين",
      eyebrow:"GIFT CARD",
      amounts:[400,500,700,1000],
      rekazPriceId:""
    },
    memberships: {
      heroTitle:"عضوية النخبة",
      heroSubtitle:"تجربة فاخرة لا تُنسى — امتيازات حصرية لعضو مميز",
      featTitle:"الخدمات المشمولة",
      featSubtitle:"كل زيارة تشمل مجموعة من الخدمات الفاخرة المختارة بعناية",
      plansTitle:"اختاري باقتك",
      plansSub:"اشتراك سنوي يشمل 12 زيارة بخدمات متكاملة",
      howTitle:"كيف تعمل العضوية؟",
      privTitle:"امتيازات العضوية",
      statVisits:"12",
      featureCategories:[
        {label:"الأظافر",open:true,feats:[
          {text:"مناكير روسي كامل",sub:"الأظافر والقدمين"},
          {text:"بياب مع إطالة أو جل اكستنشن"},
          {text:"رسم وتصميم مميز"}
        ]},
        {label:"العناية بالبشرة",open:false,feats:[
          {text:"تنظيف بشرة عميق",sub:"30 دقيقة"},
          {text:"علاج فيشيال مخصص"},
          {text:"قناع مرطب وبرايتنينج"}
        ]},
        {label:"المساج والاسترخاء",open:false,feats:[
          {text:"مساج جزئي 30 دقيقة"},
          {text:"علاج للرأس والكتفين"}
        ]},
        {label:"الامتيازات الإضافية",open:false,feats:[
          {text:"استشوار وقص عند الحاجة"},
          {text:"لون جل يدين وأقدام"},
          {text:"رموش كلاسيك"}
        ]}
      ],
      privileges:[
        {icon:"🚗",title:"سيارة فاخرة",sub:"توصيل بسيارة BMW أو S500 للزيارة الأولى"},
        {icon:"📅",title:"جدول مرن",sub:"مواعيد تناسب وقتك دون قيود"},
        {icon:"🏡",title:"خدمات منزلية",sub:"إمكانية الحصول على الخدمة في منزلك"},
        {icon:"🏆",title:"حفل سنوي VIP",sub:"طاولة خاصة بك في الحفل السنوي"},
        {icon:"🎁",title:"هدايا ومفاجآت",sub:"جوائز تلقائية وعروض حصرية"},
        {icon:"⭐",title:"تكريم خاص",sub:"معاملة VIP واهتمام مخصص"}
      ],
      howSteps:[
        {num:"01",title:"اختاري باقتك",desc:"اختاري الباقة المناسبة واضغطي على اشتراكي الآن"},
        {num:"02",title:"أدخلي بياناتك",desc:"أدخلي اسمك ورقم جوالك لإتمام التسجيل"},
        {num:"03",title:"أتمّي الدفع",desc:"دفع آمن ومشفر عبر بوابة الدفع"},
        {num:"04",title:"استمتعي بعضويتك",desc:"ستصلك تفاصيل عضويتك وبطاقتك الذهبية فوراً"}
      ],
      items:[
        {name:"Classic",price:4000,featured:false,visits:12,rekazPriceId:"",
         features:["مناكير روسي كامل","علاج فيشيال للبشرة","12 زيارة / 12 شهراً"]},
        {name:"VIP",price:8000,featured:true,visits:12,rekazPriceId:"",
         features:["جل اكستنشن أو بياب","مناكير روسي","علاج فيشيال","رموش كلاسيك","12 زيارة / 12 شهراً"]},
        {name:"V-VIP",price:10000,featured:false,visits:12,rekazPriceId:"",
         features:["كل مميزات VIP","30 دقيقة مساج","استشوار وقص","خدمات منزلية","12 زيارة / 12 شهراً"]}
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
  console.warn("[DB] WARNING: Could not save to disk! Data in memory only.");
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
  // 204 No Content = success with empty body (e.g. PUT reservation)
  return { ok:r.ok, status:r.status, text:text||"", json:()=>text?JSON.parse(text):{} };
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
// Admin HTML served from admin.html file
app.get("/", (req,res) => res.send("GRAFF SPA API ✅"));
app.get("/admin", (req,res) => {
  try {
    const html = readFileSync(process.cwd()+"/admin.html","utf8");
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.send(html);
  } catch(e) {
    res.status(500).send("admin.html not found: "+e.message);
  }
});


app.get("/site", (req,res) => {
  const db = readDB();
  res.json({
    theme:    db.theme,
    layout:   db.layout,
    texts:    db.texts,
    social:   db.social,
    buttons:  db.buttons.filter(b=>b.visible!==false).sort((a,b)=>a.order-b.order),
    payments: db.payments.filter(p=>p.visible!==false).sort((a,b)=>a.order-b.order),
    pages:    db.pages,
    policies: db.policies||{ar:"",en:""}
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
                description: (p.description || p.shortDescription || ""),
                options: [],
                // addOns from product level (productAddOns)
                addOns: (p.addOns || []).map(ao => {
                  const aoName = (
                    ao.label ||
                    (ao.localizedLabel?.OtherLanguages?.ar) ||
                    ""
                  ).trim();
                  if (!aoName) return null;
                  // Rekaz uses immutableId as the customFields key (not id)
                  const customFieldKey = ao.immutableId || ao.id;
                  return { id: customFieldKey, nameAr: aoName, amount: ao.amount || 0 };
                }).filter(Boolean)
              };
              acc.push(existing);
            }
            // Add pricing option
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
                duration: rd.pricing.duration || p.duration || 0
              });
            } else if (!existing.options.length) {
              existing.options.push({
                id: s.rekazPriceId || pid,
                nameAr: "",
                nameEn: "",
                amount: p.amount || 0,
                duration: p.duration || 0
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
  const {customerId,phone,priceId,from,to,addons}=req.body;
  if(!customerId||!priceId||!from||!to) return res.status(400).json({error:"Missing fields"});
  if(phone){
    const s=otpStore[phone];
    if(s && !s.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
  }
  try {
    const addOnList = (addons||[]).filter(a=>a.id);

    // Rekaz uses CustomFields for addOns: key=addOn.id, value=true
    // Source: Rekaz network tab shows CustomFields[addonId]=true
    const customFields = {};
    addOnList.forEach(a => { customFields[a.id] = "true"; });

    const payload = {
      customerId,
      branchId: BRANCH_ID,
      items: [{
        priceId,
        quantity: 1,
        from,
        to,
        customFields
      }]
    };
    console.log("[Booking] payload:", JSON.stringify(payload, null, 2));
    const r = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
      method: "POST",
      body: JSON.stringify(payload)
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
    console.log(`[Booking] payUrl: ${payUrl}`);
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
    subSections: req.body.subSections||[],
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
app.get("/admin/rekaz-products",adminAuth,async(req,res)=>{
  try{res.json(await getProds());}catch(e){res.status(500).json({error:e.message});}
});

// ── POLICIES ──
app.get("/admin/policies", adminAuth, (req,res) => res.json(readDB().policies||{}));
app.put("/admin/policies", adminAuth, (req,res) => {
  const db=readDB(); db.policies=req.body; writeDB(db); res.json({success:true});
});

// ── GIFT PAGE ──
app.get("/gift",(req,res)=>{
  try{const html=readFileSync(process.cwd()+"/gift.html","utf8");res.setHeader("Content-Type","text/html; charset=utf-8");res.send(html);}
  catch(e){res.status(404).send("gift.html not found");}
});

// ── MEMBERSHIP PAGE ──
app.get("/membership",(req,res)=>{
  try{const html=readFileSync(process.cwd()+"/membership.html","utf8");res.setHeader("Content-Type","text/html; charset=utf-8");res.send(html);}
  catch(e){res.status(404).send("membership.html not found");}
});
// ── REKAZ: GIFT CARD PRODUCT INFO ──
// Fetches gift card pricing IDs from Rekaz (type=Gift products)
app.get("/gift-products", async (req, res) => {
  try {
    // Get all products and filter for Gift type
    const data = await getProds();
    const gifts = (data.items || []).filter(p => p.typeString === "Gift" || p.type === 3);
    res.json({ items: gifts });
  } catch(e) {
    // Try direct fetch of gift-card product
    try {
      const r = await rekazFetch(`${REKAZ_BASE}/api/app/product/product/gift-card`);
      if (r.ok) return res.json({ items: [r.json()] });
    } catch(e2) {}
    res.status(500).json({ error: e.message });
  }
});

// ── REKAZ: MERCHANDISE/GIFT PURCHASE via SUBSCRIPTIONS ──
// Based on Rekaz API docs: isSubscriptionAvailable=true products use POST /subscriptions
// Membership (Merchandise) and Gift Card both use this endpoint

app.post("/gift/purchase", async (req, res) => {
  const { amount, fromName, fromPhone, toName, toPhone, message, showSender, priceId } = req.body;
  if (!amount || !fromName || !fromPhone || !toName || !toPhone)
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  try {
    const db = readDB();
    // Hardcoded pricing IDs extracted from Rekaz source
    const GIFT_PRICE_IDS = {
      "400": "3a20ab64-fb29-8449-e1ef-c92188e204ed",
      "500": "3a20ab64-fb29-6a4b-6338-39f7599d1edd",
      "700": "3a20ab64-fb29-1904-97de-b77afcba741b",
      "1000": "3a20ab64-fb29-e566-ee8c-b74c462a3d5f"
    };
    const dbPrices = db.pages?.gift?.rekazPrices || {};
    // Use admin-set price first, then hardcoded, then fallback
    const giftPriceId = priceId
      || dbPrices[String(amount)]
      || GIFT_PRICE_IDS[String(amount)]
      || db.pages?.gift?.rekazPriceId
      || null;
    console.log("[Gift] amount:", amount, "priceId:", giftPriceId);
    const orderRef = "GIFT-" + Date.now().toString(36).toUpperCase();
    let payUrl = null;
    let invoiceId = null;

    if (giftPriceId) {
      const mobile = fromPhone.startsWith("+966") ? fromPhone : "+966" + fromPhone.replace(/^0/, "");
      const toMobile = toPhone.startsWith("+966") ? toPhone : "+966" + toPhone.replace(/^0/, "");

      // Try POST /api/public/subscriptions (works for Gift & Merchandise)
      try {
        // Try subscriptions API (isSubscriptionAvailable=true for Gift)
          const payload = {
            customerDetails: { name: fromName, mobileNumber: mobile, type: 1 },
            branchId: BRANCH_ID,
            items: [{ priceId: giftPriceId, quantity: 1 }]
          };
          const r = await rekazFetch(`${REKAZ_API}/subscriptions`, {
            method: "POST", body: JSON.stringify(payload)
          });
          if (r.ok) {
            const result = r.json();
            invoiceId = result.invoiceId || null;
            if (invoiceId) payUrl = `${REKAZ_BASE}/i/${invoiceId}`;
          }
          // Fallback: reservations/bulk
          if (!invoiceId) {
            const r2 = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
              method: "POST",
              body: JSON.stringify({
                customerDetails: { name: fromName, mobileNumber: mobile, type: 1 },
                branchId: BRANCH_ID,
                items: [{ priceId: giftPriceId, quantity: 1, customFields: {
                  gift_to_name: toName, gift_to_phone: toMobile,
                  gift_from_name: showSender ? fromName : "", gift_message: message||""
                }}]
              })
            });
            if (r2.ok) {
              const res2 = r2.json();
              invoiceId = res2.invoiceId || null;
              const pp = res2.paymentLink || "";
              payUrl = pp ? (pp.startsWith("http") ? pp : `${REKAZ_BASE}${pp}`) : (invoiceId ? `${REKAZ_BASE}/i/${invoiceId}` : null);
            }

      } catch(e) { console.log("[Gift] purchase error:", e.message); }
    }

    if (!db.giftOrders) db.giftOrders = [];
    db.giftOrders.unshift({
      ref: orderRef, invoiceId, amount, fromName, fromPhone,
      toName, toPhone, message: message || "", showSender: !!showSender,
      createdAt: new Date().toISOString(),
      status: payUrl ? "pending_payment" : (giftPriceId ? "rekaz_failed" : "pending_review")
    });
    writeDB(db);

    res.json({ success: true, orderRef, invoiceId, payUrl, giftCode: invoiceId || orderRef });
  } catch(e) {
    console.error("[Gift Purchase]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── REKAZ: MEMBERSHIP PURCHASE ──
app.post("/membership/purchase", async (req, res) => {
  const { planName, planIndex, price, name, phone, email } = req.body;
  if (!planName || !price || !name || !phone)
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  try {
    const db = readDB();
    const memItems = db.pages?.memberships?.items || [];
    const plan = typeof planIndex === "number" ? memItems[planIndex] : memItems.find(m => m.name === planName);
    const priceId = plan?.rekazPriceId || null;
    const orderRef = "MEM-" + Date.now().toString(36).toUpperCase();
    let payUrl = null;
    let invoiceId = null;

    if (priceId) {
      const mobile = phone.startsWith("+966") ? phone : "+966" + phone.replace(/^0/, "");

      // Membership (Merchandise) uses POST /api/public/subscriptions
      try {
        const payload = {
          customerDetails: {
            name,
            mobileNumber: mobile,
            email: email || undefined,
            type: 1
          },
          branchId: BRANCH_ID,
          items: [{ priceId, quantity: 1 }]
        };

        const r = await rekazFetch(`${REKAZ_API}/subscriptions`, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        console.log("[Mem] subscriptions response:", r.status, r.text.slice(0, 300));

        if (r.ok) {
          const result = r.json();
          invoiceId = result.invoiceId || null;
          if (invoiceId) payUrl = `${REKAZ_BASE}/i/${invoiceId}`;
        } else {
          // Fallback: reservations/bulk
          const r2 = await rekazFetch(`${REKAZ_API}/reservations/bulk`, {
            method: "POST",
            body: JSON.stringify({
              customerDetails: { name, mobileNumber: mobile, type: 1 },
              branchId: BRANCH_ID,
              items: [{ priceId, quantity: 1 }]
            })
          });
          if (r2.ok) {
            const res2 = r2.json();
            invoiceId = res2.invoiceId || null;
            const pp = res2.paymentLink || "";
            payUrl = pp ? (pp.startsWith("http") ? pp : `${REKAZ_BASE}${pp}`) : (invoiceId ? `${REKAZ_BASE}/i/${invoiceId}` : null);
          }
        }
      } catch(e) { console.log("[Mem] purchase error:", e.message); }
    }

    if (!db.membershipOrders) db.membershipOrders = [];
    db.membershipOrders.unshift({
      ref: orderRef, invoiceId, planName, price, name,
      phone: phone.replace(/^0/, "966"), email: email || "",
      createdAt: new Date().toISOString(),
      status: payUrl ? "pending_payment" : (priceId ? "rekaz_failed" : "pending_review")
    });
    writeDB(db);

    res.json({ success: true, orderRef, invoiceId, payUrl });
  } catch(e) {
    console.error("[Mem Purchase]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: ORDERS ──
app.get("/admin/gift-orders", adminAuth, (req, res) => { res.json(readDB().giftOrders || []); });
app.get("/admin/membership-orders", adminAuth, (req, res) => { res.json(readDB().membershipOrders || []); });
app.put("/admin/gift-orders/:ref", adminAuth, (req, res) => {
  const db = readDB(); const o = (db.giftOrders || []).find(x => x.ref === req.params.ref);
  if (!o) return res.status(404).json({ error: "Not found" });
  Object.assign(o, req.body); writeDB(db); res.json({ success: true });
});
app.put("/admin/membership-orders/:ref", adminAuth, (req, res) => {
  const db = readDB(); const o = (db.membershipOrders || []).find(x => x.ref === req.params.ref);
  if (!o) return res.status(404).json({ error: "Not found" });
  Object.assign(o, req.body); writeDB(db); res.json({ success: true });
});

// ── DEBUG ──
app.get("/debug-rekaz",async(req,res)=>{
  try{const data=await getProds();res.json(data);}
  catch(e){res.status(500).json({error:e.message});}
});
app.get("/debug-product/:id",async(req,res)=>{
  try{
    const r=await rekazFetch(`${REKAZ_API}/products/${req.params.id}`);
    res.send(r.text);
  }catch(e){res.status(500).send(e.message);}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`[GRAFF SPA] Server on port ${PORT}`);
  readDB();
});
