import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
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
const DB_FILE    = "/tmp/graff_db.json";

// ── Default DB ──
const DEFAULT_DB = {
  categories: [],
  services: [],
  theme: {
    primaryColor:"#b8965a", primaryHover:"#c8a66a",
    bgDark:"#080807", bgDark2:"#0c0b09",
    bgLight:"#f3ede3", textColor:"#17150e",
    mutedColor:"#78706a", borderColor:"#d8d0c0",
    fontArabic:"Tajawal", fontDisplay:"Cormorant Garamond",
    borderRadius:0, logoAccent:"#b8965a"
  },
  layout: {
    heroTagline:"حيث تلتقي العناية بالفخامة · في أدق تفاصيلها",
    heroCity:"R I Y A D H", logoText:"GRAFF SPA",
    logoImage:"", vatNumber:"314257469500003"
  },
  social: { instagram:"", instagram_user:"", tiktok:"", tiktok_user:"",
            whatsapp:"966500000000", twitter:"", twitter_user:"",
            snapchat:"", snapchat_user:"" },
  buttons: [
    { id:"btn_1", textAr:"احجزي موعدك الآن", action:"booking", style:"primary", order:1, visible:true },
    { id:"btn_2", textAr:"أهدي من تحبين",    action:"gift",    style:"outline", order:2, visible:true },
    { id:"btn_3", textAr:"العضويات",          action:"memberships", style:"outline", order:3, visible:true },
    { id:"btn_4", textAr:"تواصلي معنا",       action:"whatsapp", style:"outline", order:4, visible:true }
  ],
  payments: [
    { id:"mastercard", label:"Mastercard", visible:true, order:1, customImage:"" },
    { id:"visa",       label:"Visa",       visible:true, order:2, customImage:"" },
    { id:"mada",       label:"mada",       visible:true, order:3, customImage:"" },
    { id:"applepay",   label:"Apple Pay",  visible:true, order:4, customImage:"" },
    { id:"tabby",      label:"tabby",      visible:true, order:5, customImage:"" },
    { id:"tamara",     label:"tamara",     visible:true, order:6, customImage:"" }
  ],
  pages: {
    gift: {
      title:"بطاقة الإهداء", subtitle:"اهدي تجربة لا تُنسى",
      amounts:[200,300,500,1000], sections:[]
    },
    memberships: { items:[
      { name:"Classic", price:4000, featured:false, features:["مناكير روسي","علاج فيشيال","12 زيارة"] },
      { name:"VIP",     price:8000, featured:true,  features:["جل اكستنشن","مناكير روسي","علاج فيشيال","12 زيارة"] },
      { name:"V-VIP",   price:10000,featured:false, features:["كل مميزات VIP","رموش","مساج","12 زيارة"] }
    ]}
  },
  custom_pages: []
};

function readDB() {
  try {
    if (existsSync(DB_FILE)) {
      const raw = JSON.parse(readFileSync(DB_FILE,"utf8"));
      return merge(JSON.parse(JSON.stringify(DEFAULT_DB)), raw);
    }
  } catch(e) { console.error("DB read error:",e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}
function writeDB(db) { writeFileSync(DB_FILE, JSON.stringify(db,null,2),"utf8"); }
function merge(t, s) {
  for (const k of Object.keys(s)) {
    if (s[k]&&typeof s[k]==="object"&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==="object"&&!Array.isArray(t[k]))
      merge(t[k],s[k]);
    else t[k]=s[k];
  }
  return t;
}
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

let rCache=null, rCacheTime=0;
const CACHE_TTL=10*60*1000;
const otpStore={};

async function rekazFetch(url,opts={}) {
  console.log(`[Rekaz] ${opts.method||"GET"} ${url}`);
  const r = await fetch(url,{...opts,headers:{...RH(),...(opts.headers||{})}});
  const text = await r.text();
  console.log(`[Rekaz] ${r.status}: ${text.slice(0,200)}`);
  if(!text) throw new Error("Empty Rekaz response");
  return {ok:r.ok,status:r.status,text,json:()=>JSON.parse(text)};
}
async function getProds() {
  if(rCache&&Date.now()-rCacheTime<CACHE_TTL) return rCache;
  const r=await rekazFetch(`${REKAZ_API}/products`);
  if(!r.ok) throw new Error("Rekaz products failed");
  rCache=r.json(); rCacheTime=Date.now();
  return rCache;
}

function auth(req,res,next) {
  if((req.headers.authorization||"").replace("Bearer ","")!==ADMIN_PASS)
    return res.status(401).json({error:"Unauthorized"});
  next();
}

// ── PUBLIC ──
app.get("/", (req,res)=>res.send("GRAFF SPA API ✅"));

app.get("/site", (req,res) => {
  const db=readDB();
  res.json({
    theme:db.theme, layout:db.layout, social:db.social,
    buttons:db.buttons.filter(b=>b.visible!==false).sort((a,b)=>a.order-b.order),
    payments:db.payments.filter(p=>p.visible!==false).sort((a,b)=>a.order-b.order),
    pages:db.pages, custom_pages:(db.custom_pages||[]).filter(p=>p.visible!==false)
  });
});

app.get("/menu", async (req,res) => {
  try {
    const db=readDB();
    const rekazData=await getProds();
    const items=rekazData.items||[];
    const byPriceId={}, byProductId={};
    items.forEach(p => {
      byProductId[p.id]=p;
      (p.pricing||[]).forEach(pr => byPriceId[pr.id]={product:p,pricing:pr});
      if(!p.pricing||!p.pricing.length) byPriceId[p.id]={product:p,pricing:null};
    });
    const cats = db.categories
      .filter(c=>c.visible!==false)
      .sort((a,b)=>a.order-b.order)
      .map(cat => {
        const svcs = db.services
          .filter(s=>s.categoryId===cat.id&&s.visible!==false)
          .sort((a,b)=>a.order-b.order)
          .map(s => {
            const rd=byPriceId[s.rekazPriceId]||(s.rekazProductId?{product:byProductId[s.rekazProductId],pricing:null}:null);
            if(!rd||!rd.product) return null;
            const p=rd.product;
            return {
              id:s.id, rekazPriceId:s.rekazPriceId, rekazProductId:p.id,
              nameAr: s.nameAr||(p.nameAr||p.name||"").split(" - ")[0].trim(),
              amount: rd.pricing?rd.pricing.amount:(p.amount||0),
              duration: rd.pricing?(rd.pricing.duration||p.duration||0):(p.duration||0),
              description: (p.description||p.shortDescription||""),
              hasVariants: p.pricing&&p.pricing.length>1,
              variants: (p.pricing&&p.pricing.length>1)?p.pricing.map(pr=>({
                id:pr.id,name:(pr.name||""),amount:pr.amount,duration:pr.duration||p.duration||0
              })):[],
              addOns: (p.addOns||[]).map(ao=>({
                id:ao.id,nameAr:(ao.nameAr||ao.name||"").split(" - ")[0].trim(),amount:ao.amount||0
              }))
            };
          }).filter(Boolean);
        return {id:cat.id,nameAr:cat.nameAr,nameEn:cat.nameEn||"",subLabel:cat.subLabel||"",services:svcs};
      }).filter(c=>c.services.length>0);
    res.json({categories:cats});
  } catch(e) { console.error("[/menu]",e.message); res.status(500).json({error:e.message}); }
});

app.get("/slots", async (req,res) => {
  try {
    const q=new URLSearchParams(req.query).toString();
    const r=await rekazFetch(`${REKAZ_API}/reservations/slots?${q}`);
    res.status(r.status).send(r.text);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/send-otp",(req,res)=>{
  const {phone}=req.body; if(!phone) return res.status(400).json({error:"Phone required"});
  const otp=Math.floor(1000+Math.random()*9000).toString();
  otpStore[phone]={otp,expires:Date.now()+5*60*1000,verified:false};
  console.log(`[OTP] ${phone}: ${otp}`);
  res.json({success:true,debug_otp:otp});
});
app.post("/verify-otp",(req,res)=>{
  const {phone,otp}=req.body;
  const s=otpStore[phone];
  if(!s) return res.status(400).json({error:"أرسلي رمزاً جديداً"});
  if(Date.now()>s.expires){delete otpStore[phone];return res.status(400).json({error:"انتهت صلاحية الرمز"});}
  if(s.otp!==otp.toString()) return res.status(400).json({error:"الرمز غير صحيح"});
  otpStore[phone].verified=true; res.json({success:true});
});
app.post("/create-customer",async(req,res)=>{
  const {name,phone}=req.body;
  if(!name||!phone) return res.status(400).json({error:"Name and phone required"});
  const s=otpStore[phone]; if(!s||!s.verified) return res.status(403).json({error:"يجب التحقق من الجوال أولاً"});
  try {
    const mobile=phone.startsWith("+966")?phone:"+966"+phone.replace(/^0/,"");
    const chk=await rekazFetch(`${REKAZ_API}/customers?mobileNumber=${encodeURIComponent(mobile)}`);
    if(chk.ok){const d=chk.json();if(d.items?.length) return res.json({customerId:d.items[0].id});}
    const r=await rekazFetch(`${REKAZ_API}/customers`,{method:"POST",body:JSON.stringify({name,mobileNumber:mobile,type:1})});
    if(!r.ok) return res.status(r.status).json({error:"فشل إنشاء العميل"});
    res.json({customerId:r.json()});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post("/create-booking",async(req,res)=>{
  const {customerId,phone,priceId,from,to}=req.body;
  if(!customerId||!priceId||!from||!to) return res.status(400).json({error:"Missing fields"});
  if(phone){const s=otpStore[phone];if(!s?.verified) return res.status(403).json({error:"Phone not verified"});}
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
    const orderNumber=result.orderId||result.orderNumber||result.reservationNumber||null;
    console.log(`[Booking] Order:${orderNumber} Pay:${payUrl}`);
    res.json({success:true,orderNumber,payUrl});
  } catch(e){res.status(500).json({error:e.message});}
});

// ── ADMIN ──
app.post("/admin/login",(req,res)=>{
  if(req.body.password===ADMIN_PASS) res.json({success:true,token:ADMIN_PASS});
  else res.status(401).json({error:"كلمة المرور غير صحيحة"});
});
app.get("/admin/db",auth,(req,res)=>res.json(readDB()));
app.put("/admin/db",auth,(req,res)=>{
  try{writeDB(req.body);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get("/admin/categories",auth,(req,res)=>res.json(readDB().categories));
app.post("/admin/categories",auth,(req,res)=>{
  const db=readDB();
  const cat={id:"cat_"+uid(),nameAr:req.body.nameAr||"قسم جديد",nameEn:req.body.nameEn||"",
    subLabel:req.body.subLabel||"",order:db.categories.length+1,visible:true};
  db.categories.push(cat); writeDB(db); res.json(cat);
});
app.put("/admin/categories/:id",auth,(req,res)=>{
  const db=readDB(); const i=db.categories.findIndex(c=>c.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Not found"});
  db.categories[i]={...db.categories[i],...req.body,id:req.params.id};
  writeDB(db); res.json(db.categories[i]);
});
app.delete("/admin/categories/:id",auth,(req,res)=>{
  const db=readDB();
  db.categories=db.categories.filter(c=>c.id!==req.params.id);
  db.services=db.services.filter(s=>s.categoryId!==req.params.id);
  writeDB(db); res.json({success:true});
});
app.put("/admin/categories-order",auth,(req,res)=>{
  const db=readDB(); const {order}=req.body;
  order.forEach((id,idx)=>{const i=db.categories.findIndex(c=>c.id===id);if(i>=0)db.categories[i].order=idx+1;});
  writeDB(db); res.json({success:true});
});
app.put("/admin/categories/:id/services",auth,(req,res)=>{
  const db=readDB(); const catId=req.params.id;
  db.services=db.services.filter(s=>s.categoryId!==catId);
  (req.body.priceIds||[]).forEach((item,idx)=>{
    db.services.push({id:"srv_"+uid(),rekazPriceId:item.rekazPriceId,
      rekazProductId:item.rekazProductId||null,categoryId:catId,
      nameAr:item.nameAr||"",order:idx+1,visible:true});
  });
  writeDB(db); res.json({success:true,count:(req.body.priceIds||[]).length});
});
app.get("/admin/rekaz-products",auth,async(req,res)=>{
  try{res.json(await getProds());}catch(e){res.status(500).json({error:e.message});}
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`[GRAFF SPA] Server on port ${PORT}`));
