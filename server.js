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
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GRAFF SPA — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap" rel="stylesheet">
<style>
:root{--ink:#080807;--ink2:#0f0d0a;--ink3:#1a1713;--gold:#b8965a;--gold2:#c8a66a;--sb:230px;--red:#c0392b;--green:#27ae60}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Tajawal',sans-serif;background:var(--ink2);color:#fff;direction:rtl;-webkit-font-smoothing:antialiased}
#login{position:fixed;inset:0;background:var(--ink);display:flex;align-items:center;justify-content:center;z-index:999}
#login.hide{display:none}
.lbox{background:var(--ink3);border:1px solid rgba(184,150,90,.2);padding:40px 32px;width:340px;text-align:center}
.llogo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;letter-spacing:.2em;color:#fff;margin-bottom:4px}
.llogo b{color:var(--gold);font-weight:300}
.lsub{font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.12em;margin-bottom:28px}
.linp{width:100%;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:'Tajawal',sans-serif;font-size:14px;outline:none;text-align:center;margin-bottom:10px}
.linp:focus{border-color:rgba(184,150,90,.4)}
.lbtn{width:100%;padding:13px;background:var(--gold);color:var(--ink);border:none;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:500;letter-spacing:.14em;cursor:pointer}
.lbtn:hover{background:var(--gold2)}
.lerr{font-size:11px;color:#e74c3c;margin-top:8px;min-height:18px}
#app{display:none;min-height:100vh}
#app.on{display:flex}
.sidebar{width:var(--sb);background:var(--ink);border-left:1px solid rgba(184,150,90,.1);display:flex;flex-direction:column;flex-shrink:0;position:fixed;top:0;right:0;bottom:0;overflow-y:auto;z-index:10}
.sl-logo{padding:20px 18px 14px;border-bottom:1px solid rgba(184,150,90,.1)}
.sl-logo-t{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:300;letter-spacing:.18em;color:#fff}
.sl-logo-t b{color:var(--gold);font-weight:300}
.sl-sec{font-size:8px;letter-spacing:.2em;color:rgba(255,255,255,.28);padding:14px 18px 5px;text-transform:uppercase}
.ni{display:flex;align-items:center;gap:9px;padding:9px 18px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.44);border-right:2px solid transparent;transition:all .13s}
.ni:hover{color:#fff;background:rgba(255,255,255,.03)}
.ni.on{color:#fff;border-right-color:var(--gold);background:rgba(184,150,90,.06)}
.ni svg{width:15px;height:15px;opacity:.6;flex-shrink:0}
.ni.on svg{opacity:1}
.sl-foot{margin-top:auto;padding:12px 18px;border-top:1px solid rgba(184,150,90,.1)}
.lout-btn{width:100%;padding:8px;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);font-family:'Tajawal',sans-serif;font-size:11px;cursor:pointer}
.lout-btn:hover{border-color:rgba(184,150,90,.3);color:#fff}
.main{margin-right:var(--sb);flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--ink);border-bottom:1px solid rgba(184,150,90,.1);padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:sticky;top:0;z-index:5}
.tb-title{font-size:14px;font-weight:500;color:#fff}
.tb-r{display:flex;align-items:center;gap:10px}
.save-ok{font-size:11px;color:var(--green);opacity:0;transition:opacity .3s}
.save-ok.on{opacity:1}
.sbtn{padding:8px 18px;background:var(--gold);color:var(--ink);border:none;font-family:'Tajawal',sans-serif;font-size:11px;font-weight:500;letter-spacing:.1em;cursor:pointer}
.sbtn:hover{background:var(--gold2)}
.sbtn:disabled{opacity:.5;pointer-events:none}
.content{flex:1;padding:22px;max-width:960px;width:100%}
.panel{display:none}
.panel.on{display:block;animation:fi .18s ease}
@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.card{background:var(--ink3);border:1px solid rgba(255,255,255,.07);padding:20px;margin-bottom:14px}
.card-ttl{font-size:11px;font-weight:500;letter-spacing:.1em;color:rgba(255,255,255,.65);margin-bottom:16px;display:flex;align-items:center;gap:8px;text-transform:uppercase}
.card-ttl::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07)}
.f{margin-bottom:12px}
.f label{display:block;font-size:10px;letter-spacing:.09em;color:rgba(255,255,255,.4);margin-bottom:5px}
.f input,.f select,.f textarea{width:100%;padding:9px 11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:'Tajawal',sans-serif;font-size:13px;outline:none;transition:border-color .13s}
.f input:focus,.f select:focus,.f textarea:focus{border-color:rgba(184,150,90,.4)}
.f select option{background:var(--ink)}
.f textarea{resize:vertical;min-height:60px}
.f input[type=color]{padding:3px 5px;height:34px;cursor:pointer}
.f input[type=range]{padding:0;background:none;border:none;accent-color:var(--gold)}
.gr2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.tog{width:38px;height:21px;background:rgba(255,255,255,.12);border-radius:11px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;display:inline-block}
.tog.on{background:var(--gold)}
.tog::after{content:'';width:17px;height:17px;background:#fff;border-radius:50%;position:absolute;top:2px;right:2px;transition:right .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.tog.on::after{right:19px}
.li{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:11px 12px;display:flex;align-items:center;gap:9px;margin-bottom:7px}
.dh{color:rgba(255,255,255,.2);font-size:16px;cursor:grab;flex-shrink:0;user-select:none}
.li-info{flex:1;min-width:0}
.li-name{font-size:13px;color:#fff;margin-bottom:2px}
.li-sub{font-size:10px;color:rgba(255,255,255,.32);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.li-acts{display:flex;gap:5px;align-items:center;flex-shrink:0}
.lb{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.44);font-size:10px;padding:4px 9px;cursor:pointer;font-family:'Tajawal',sans-serif;transition:all .12s}
.lb:hover{border-color:rgba(184,150,90,.35);color:#fff}
.lb.del:hover{border-color:rgba(192,57,43,.4);color:var(--red)}
.add-btn{padding:8px 16px;background:transparent;border:1px solid rgba(184,150,90,.3);color:var(--gold);font-family:'Tajawal',sans-serif;font-size:11px;letter-spacing:.09em;cursor:pointer;margin-top:10px;display:inline-block}
.add-btn:hover{background:rgba(184,150,90,.07)}
.swatch{width:100%;height:32px;border:1px solid rgba(255,255,255,.1);margin-bottom:5px}
.st-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:5px}
.st-dot.live{background:var(--green)}
/* OVERLAY/MODAL */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:none;align-items:center;justify-content:center;padding:12px}
.overlay.on{display:flex}
.modal{background:var(--ink3);border:1px solid rgba(184,150,90,.2);padding:22px;width:100%;max-width:680px;max-height:94vh;overflow-y:auto}
.modal-ttl{font-size:15px;font-weight:500;color:#fff;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.modal-x{background:none;border:none;color:rgba(255,255,255,.4);font-size:22px;cursor:pointer;padding:0 4px;line-height:1}
.modal-x:hover{color:#fff}
.modal-btns{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}
.btn-p{padding:9px 20px;background:var(--gold);color:var(--ink);border:none;font-family:'Tajawal',sans-serif;font-size:11px;font-weight:500;cursor:pointer}
.btn-p:hover{background:var(--gold2)}
.btn-s{padding:9px 16px;background:transparent;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.55);font-family:'Tajawal',sans-serif;font-size:11px;cursor:pointer}
/* Sub-section editor */
.sub-editor{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);padding:14px;margin-bottom:9px}
.sub-editor-ttl{font-size:11px;color:rgba(255,255,255,.55);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
/* Rekaz picker */
.rp-search{width:100%;padding:8px 11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-family:'Tajawal',sans-serif;font-size:12px;outline:none;margin-bottom:7px}
.rp-list{max-height:240px;overflow-y:auto;border:1px solid rgba(255,255,255,.08)}
.rp-item{display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;gap:8px}
.rp-item:last-child{border:none}
.rp-item:hover{background:rgba(255,255,255,.04)}
.rp-item.sel{background:rgba(184,150,90,.08)}
.rp-chk{width:15px;height:15px;border:1.5px solid rgba(255,255,255,.2);flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rp-item.sel .rp-chk{background:var(--gold);border-color:var(--gold)}
.rp-chk-i{width:9px;height:9px;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L3.5 6.5L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") center/contain no-repeat;opacity:0}
.rp-item.sel .rp-chk-i{opacity:1}
.rp-name{font-size:12px;color:#fff;flex:1;line-height:1.3}
.rp-price{font-size:10px;color:var(--gold);white-space:nowrap}
/* Texts editor */
.text-group{margin-bottom:20px}
.text-group-ttl{font-size:10px;letter-spacing:.12em;color:var(--gold);margin-bottom:10px;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid rgba(184,150,90,.15)}
.text-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.text-row:last-child{border:none}
.text-lbl{font-size:11px;color:rgba(255,255,255,.5);width:180px;flex-shrink:0}
.text-inp{flex:1;padding:6px 9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;font-family:'Tajawal',sans-serif;font-size:12px;outline:none}
.text-inp:focus{border-color:rgba(184,150,90,.4)}
/* Mem editor */
.mem-edit{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:14px;margin-bottom:9px}
.mem-edit-ttl{font-size:12px;color:#fff;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
@media(max-width:768px){.sidebar{display:none}.main{margin-right:0}.gr2,.gr3{grid-template-columns:1fr}}
</style>
</head>
<body>
<div id="login">
  <div class="lbox">
    <div class="llogo">GRAFF <b>SPA</b></div>
    <div class="lsub">ADMIN PANEL</div>
    <input class="linp" id="linp" type="password" placeholder="كلمة المرور" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="lbtn" onclick="doLogin()">دخول</button>
    <div class="lerr" id="lerr"></div>
  </div>
</div>

<div id="app">
  <div class="sidebar">
    <div class="sl-logo"><div class="sl-logo-t">GRAFF <b>SPA</b></div></div>
    <div class="sl-sec">الإدارة</div>
    <div class="ni on" onclick="show('overview')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>نظرة عامة</div>
    <div class="ni" onclick="show('menu')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>الأقسام والخدمات</div>
    <div class="ni" onclick="show('texts')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>جميع النصوص</div>
    <div class="ni" onclick="show('design')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>التصميم والألوان</div>
    <div class="ni" onclick="show('logo')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>الشعار</div>
    <div class="sl-sec">المحتوى</div>
    <div class="ni" onclick="show('buttons')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M7 12h10"/></svg>الأزرار</div>
    <div class="ni" onclick="show('gift')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>بطاقة الإهداء</div>
    <div class="ni" onclick="show('memberships')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>العضويات</div>
    <div class="ni" onclick="show('social')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>السوشيال ميديا</div>
    <div class="ni" onclick="show('payment')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>بوابات الدفع</div>
    <div class="sl-sec">الحجز</div>
    <div class="ni" onclick="show('policies')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>السياسات</div>
    <div class="sl-foot"><button class="lout-btn" onclick="doLogout()">تسجيل الخروج</button></div>
  </div>

  <div class="main">
    <div class="topbar">
      <div class="tb-title" id="tb-title">نظرة عامة</div>
      <div class="tb-r">
        <span class="save-ok" id="save-ok">✓ تم الحفظ</span>
        <button class="sbtn" id="sbtn" onclick="saveAll()">حفظ التغييرات</button>
      </div>
    </div>
    <div class="content">

      <!-- OVERVIEW -->
      <div class="panel on" id="p-overview">
        <div class="card"><div class="card-ttl">حالة النظام</div>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">
            <div style="display:flex;justify-content:space-between"><span>Rekaz API</span><span id="rstatus"><span class="st-dot" id="rdot"></span>فحص...</span></div>
            <div style="display:flex;justify-content:space-between"><span>الأقسام</span><span id="ov-cats" style="color:var(--gold)">—</span></div>
            <div style="display:flex;justify-content:space-between"><span>الخدمات المربوطة</span><span id="ov-svcs" style="color:var(--gold)">—</span></div>
            <div style="display:flex;justify-content:space-between"><span>خدمات Rekaz</span><span id="ov-rekaz" style="color:var(--gold)">—</span></div>
          </div>
        </div>
        <div class="card"><div class="card-ttl">نسخ احتياطية</div>
          <p style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:12px;line-height:1.7">البيانات محفوظة في ذاكرة السيرفر تلقائياً. عند إعادة التشغيل تُسترجع من الملف. للحماية الكاملة قومي بتصدير النسخة الاحتياطية وحفظها.</p>
          <button class="add-btn" style="margin:0" onclick="exportDB()">تصدير نسخة احتياطية</button>
        </div>
      </div>

      <!-- MENU -->
      <div class="panel" id="p-menu">
        <div class="card"><div class="card-ttl">الأقسام والخدمات</div>
          <p style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px;line-height:1.7">كل قسم يمكن أن يحتوي على عدة <strong style="color:#fff">أقسام فرعية</strong>، وكل قسم فرعي يحتوي على خدمات محددة.</p>
          <div id="cats-list"></div>
          <button class="add-btn" onclick="openCatModal()">+ إضافة قسم رئيسي</button>
        </div>
      </div>

      <!-- TEXTS -->
      <div class="panel" id="p-texts">
        <div class="card"><div class="card-ttl">تعديل جميع نصوص الموقع</div>
          <div id="texts-editor"></div>
        </div>
      </div>

      <!-- DESIGN -->
      <div class="panel" id="p-design">
        <div class="card"><div class="card-ttl">الألوان</div>
          <div class="gr2">
            <div class="f"><label>اللون الذهبي الأساسي</label><div class="swatch" id="sw-gold"></div><input type="color" id="c-gold" oninput="sw('gold',this.value)"></div>
            <div class="f"><label>لون الخلفية الداكنة</label><div class="swatch" id="sw-ink"></div><input type="color" id="c-ink" oninput="sw('ink',this.value)"></div>
            <div class="f"><label>لون الصفحات الفاتح</label><div class="swatch" id="sw-light"></div><input type="color" id="c-light" oninput="sw('light',this.value)"></div>
            <div class="f"><label>لون النص</label><div class="swatch" id="sw-text"></div><input type="color" id="c-text" oninput="sw('text',this.value)"></div>
          </div>
        </div>
        <div class="card"><div class="card-ttl">الخطوط</div>
          <div class="gr2">
            <div class="f"><label>خط النصوص العربية</label>
              <select id="f-arabic" onchange="prevFont()">
                <option value="Tajawal">Tajawal</option><option value="Cairo">Cairo</option>
                <option value="Almarai">Almarai</option><option value="Noto Sans Arabic">Noto Sans Arabic</option>
                <option value="Readex Pro">Readex Pro</option>
              </select>
              <div id="fp" style="font-size:16px;color:rgba(255,255,255,.4);padding:8px 0">مثال على النص</div>
            </div>
            <div class="f"><label>خط العناوين الإنجليزية</label>
              <select id="f-display">
                <option value="Cormorant Garamond">Cormorant Garamond</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="EB Garamond">EB Garamond</option>
              </select>
            </div>
          </div>
          <div class="f"><label>تدوير الزوايا: <span id="brad-lbl">0</span>px</label><input type="range" id="c-brad" min="0" max="20" oninput="g('brad-lbl').textContent=this.value"></div>
          <div class="card-ttl" style="margin-top:16px">حجم عناوين الأقسام الفرعية</div>
          <div class="gr2">
            <div class="f"><label>حجم الخط الإنجليزي: <span id="sub-en-lbl">26</span>px</label><input type="range" id="c-sub-en" min="10" max="40" oninput="g('sub-en-lbl').textContent=this.value;document.documentElement.style.setProperty('--sub-en-size',this.value+'px')"></div>
            <div class="f"><label>حجم الخط العربي: <span id="sub-ar-lbl">22</span>px</label><input type="range" id="c-sub-ar" min="10" max="36" oninput="g('sub-ar-lbl').textContent=this.value;document.documentElement.style.setProperty('--sub-ar-size',this.value+'px')"></div>
          </div>
        </div>
      </div>

      <!-- LOGO -->
      <div class="panel" id="p-logo">
        <div class="card"><div class="card-ttl">الشعار</div>
          <div class="gr2">
            <div>
              <div class="f"><label>نص الشعار</label><input type="text" id="l-logo" placeholder="GRAFF SPA"></div>
              <div class="f"><label>لون الكلمة الثانية</label><div class="swatch" id="sw-acc"></div><input type="color" id="c-acc" oninput="g('sw-acc').style.background=this.value"></div>
            </div>
            <div>
              <div class="f">
                <label>صورة الشعار (PNG/SVG — تستبدل النص)</label>
                <div id="logo-prev" style="height:60px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.3)">لا توجد صورة</div>
                <label style="cursor:pointer;display:inline-block;padding:8px 14px;background:rgba(184,150,90,.15);border:1px solid rgba(184,150,90,.3);color:var(--gold);font-size:11px">
                  رفع صورة الشعار
                  <input type="file" accept="image/*" style="display:none" onchange="uploadLogo(this)">
                </label>
                <button class="lb" style="margin-right:8px" onclick="clearLogo()">حذف</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BUTTONS -->
      <div class="panel" id="p-buttons">
        <div class="card"><div class="card-ttl">أزرار الصفحة الرئيسية</div>
          <p style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px">يمكنك تعديل النص، تغيير الإجراء، إخفاء الزر، أو إضافة زر جديد</p>
          <div id="btns-list"></div>
          <button class="add-btn" onclick="addBtn()">+ إضافة زر</button>
        </div>
      </div>

      <!-- GIFT -->
      <div class="panel" id="p-gift">
        <div class="card"><div class="card-ttl">صفحة بطاقة الإهداء</div>
          <div class="gr2">
            <div class="f"><label>العنوان</label><input type="text" id="gc-title"></div>
            <div class="f"><label>العنوان الفرعي</label><input type="text" id="gc-subtitle"></div>
          </div>
          <div class="f"><label>المبالغ (مفصولة بفاصلة)</label><input type="text" id="gc-amounts" placeholder="200,300,500,1000" style="direction:ltr;text-align:left"></div>
        </div>
      </div>

      <!-- MEMBERSHIPS -->
      <div class="panel" id="p-memberships">
        <div class="card"><div class="card-ttl">باقات العضوية</div>
          <div id="mems-list"></div>
          <button class="add-btn" onclick="addMem()">+ إضافة باقة</button>
        </div>
      </div>

      <!-- SOCIAL -->
      <div class="panel" id="p-social">
        <div class="card"><div class="card-ttl">التواصل الاجتماعي</div>
          <p style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px">أدخلي اسم المستخدم فقط بدون @ وبدون الرابط الكامل</p>
          <div class="gr2">
            <div class="f"><label>Instagram — username</label><input type="text" id="s-ig" placeholder="graffspa" style="direction:ltr;text-align:left"></div>
            <div class="f"><label>TikTok — username</label><input type="text" id="s-tt" placeholder="graffspa" style="direction:ltr;text-align:left"></div>
            <div class="f"><label>Snapchat — username</label><input type="text" id="s-sc" placeholder="graffspa" style="direction:ltr;text-align:left"></div>
            <div class="f"><label>X (Twitter) — username</label><input type="text" id="s-tw" placeholder="graffspa" style="direction:ltr;text-align:left"></div>
          </div>
          <div class="f"><label>WhatsApp — رقم كامل (966xxxxxxxxx)</label><input type="text" id="s-wa" placeholder="966500000000" style="direction:ltr;text-align:left"></div>
        </div>
      </div>

      <!-- PAYMENT -->
      <div class="panel" id="p-payment">
        <div class="card"><div class="card-ttl">بوابات الدفع</div>
          <div id="pay-list"></div>
          <button class="add-btn" onclick="addPay()">+ إضافة بوابة مخصصة</button>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- CAT MODAL -->
<div class="overlay" id="cat-modal">
  <div class="modal">
    <div class="modal-ttl"><span id="cat-modal-ttl">قسم جديد</span><button class="modal-x" onclick="closeModal()">×</button></div>
    <div class="gr2">
      <div class="f"><label>الاسم العربي *</label><input type="text" id="cm-ar" placeholder="الأظافر"></div>
      <div class="f"><label>الاسم الإنجليزي</label><input type="text" id="cm-en" placeholder="NAILS"></div>
    </div>

    <div style="margin:16px 0 10px;font-size:11px;color:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:space-between">
      <span>الأقسام الفرعية (كل قسم يحتوي على خدمات محددة)</span>
      <button class="add-btn" style="margin:0;padding:5px 12px;font-size:10px" onclick="addSubSection()">+ قسم فرعي</button>
    </div>
    <div id="sub-sections-editor"></div>

    <div class="modal-btns">
      <button class="btn-p" onclick="saveCat()">حفظ القسم</button>
      <button class="btn-s" onclick="closeModal()">إلغاء</button>

      <!-- POLICIES PANEL -->
      <div class="panel" id="p-policies">
        <div class="card">
          <div class="card-ttl">السياسات — تظهر في صفحة التأكيد</div>
          <p style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px;line-height:1.8">هذا النص يظهر للعميل في صفحة التأكيد ويجب الموافقة عليه قبل الدفع.</p>
          <div class="f">
            <label>نص السياسات بالعربي</label>
            <textarea id="pol-ar" style="min-height:200px;font-size:12px;line-height:1.9"></textarea>
          </div>
        </div>
        <button class="sbtn" onclick="savePolicies()" style="margin-bottom:20px">حفظ السياسات</button>
      </div>

    </div>
  </div>
</div>

<script>
// ── UTILS first ──
const g = id => document.getElementById(id);
const e = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const esc = s => (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const setv = (id,v) => {const el=g(id);if(el)el.value=v||'';};
const setc = (id,v) => {const el=g(id);if(el)el.value=v||'';};
const setSel = (id,v) => {const el=g(id);if(!el)return;for(let i=0;i<el.options.length;i++)if(el.options[i].value===v){el.selectedIndex=i;break;}};
const sw = (k,v) => {g('sw-'+k).style.background=v;};
const api = (method,path,body) => fetch(B+path,{
  method, headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOK},
  body:body?JSON.stringify(body):undefined
}).then(r=>r.json());

const B='https://rekaz-test.onrender.com';
let TOK='',DB={},rekazProds=[],editCatId=null,subSections=[];

// ── AUTH ──
function doLogin(){
  const pw=g('linp').value;
  api('POST','/admin/login',{password:pw}).then(d=>{
    if(d.success){TOK=d.token;g('login').classList.add('hide');g('app').classList.add('on');init();}
    else g('lerr').textContent=d.error||'خطأ';
  }).catch(()=>g('lerr').textContent='لا يمكن الاتصال بالسيرفر');
}
function doLogout(){TOK='';location.reload();}
g('linp').addEventListener('keydown',ev=>{if(ev.key==='Enter')doLogin();});

async function init(){
  await loadDB();
  loadRekazProds();
  checkRekaz();
  renderAll();
}
async function loadDB(){
  DB=await api('GET','/admin/db');
  DB.categories=DB.categories||[];DB.services=DB.services||[];
  DB.texts=DB.texts||{};DB.theme=DB.theme||{};DB.layout=DB.layout||{};
  DB.social=DB.social||{};DB.buttons=DB.buttons||[];
  DB.payments=DB.payments||[];DB.pages=DB.pages||{};
  DB.policies=DB.policies||{ar:'',en:''};
}

// ── PANELS ──
const TITLES={overview:'نظرة عامة',menu:'الأقسام والخدمات',texts:'جميع النصوص',design:'التصميم والألوان',logo:'الشعار',buttons:'الأزرار',gift:'بطاقة الإهداء',memberships:'العضويات',social:'التواصل الاجتماعي',payment:'بوابات الدفع',policies:'السياسات'};
function show(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  const el=g('p-'+id);if(el)el.classList.add('on');
  const ni=document.querySelector('.ni[onclick="show(\\''+id+'\\')"');if(ni)ni.classList.add('on');
  if(g('tb-title'))g('tb-title').textContent=TITLES[id]||id;
  if(id==='policies')renderPolicies();
}
function renderAll(){renderOverview();renderMenu();renderTexts();renderDesign();renderLogo();renderButtons();renderGift();renderMems();renderSocial();renderPayment();}

// ── SAVE ──
async function saveAll(){
  const btn=g('sbtn');btn.disabled=true;btn.textContent='جاري الحفظ...';
  collectDesign();collectSocial();collectGift();collectMems();collectLogo();collectTexts();
  await api('PUT','/admin/db',DB);
  btn.disabled=false;btn.textContent='حفظ التغييرات';
  const ok=g('save-ok');ok.classList.add('on');setTimeout(()=>ok.classList.remove('on'),2500);
}
async function exportDB(){
  const d=await api('GET','/admin/db-export');
  const blob=new Blob([JSON.stringify({base64:d.base64},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='graff_db_backup.json';a.click();
}

// ── OVERVIEW ──
function renderOverview(){
  g('ov-cats').textContent=(DB.categories||[]).length+' قسم';
  g('ov-svcs').textContent=(DB.services||[]).length+' خدمة';
}
function checkRekaz(){
  fetch(B+'/').then(r=>{g('rdot').classList.toggle('live',r.ok);g('rstatus').innerHTML=(r.ok?'<span class="st-dot live"></span>متصل':'<span class="st-dot"></span>خطأ');}).catch(()=>g('rstatus').textContent='غير متصل');
}
async function loadRekazProds(){
  try{const d=await api('GET','/admin/rekaz-products');rekazProds=d.items||[];g('ov-rekaz').textContent=rekazProds.length+' خدمة';}
  catch(e){g('ov-rekaz').textContent='خطأ';}
}

// ── TEXTS ──
const TEXT_GROUPS=[
  {title:'الصفحة الرئيسية',keys:['homeEyebrow','homeTagline','homeCity','btn1Text','btn2Text','btn3Text','btn4Text','footerDesc','footerCopy','whatsappNumber']},
  {title:'صفحة الحجز',keys:['bookingStep1Title','bookingStep1Sub','bookingStep2Title','bookingStep3Title','bookingStep3Sub','bookingConfirmTitle','bookingConfirmSub','paymentSafeText']},
  {title:'صفحة الإهداء',keys:['giftEyebrow','giftTitle','giftSubtitle']},
  {title:'صفحة العضويات',keys:['membershipsEyebrow','membershipsTitle','membershipsSub']},
  {title:'المعلومات',keys:['logoText','vatNumber']}
];
const TEXT_LABELS={
  homeEyebrow:'العبارة الأولى (eyebrow)',homeTagline:'العبارة الرئيسية (tagline)',homeCity:'المدينة',
  btn1Text:'زر 1',btn2Text:'زر 2',btn3Text:'زر 3',btn4Text:'زر 4',
  footerDesc:'وصف الفوتر',footerCopy:'حقوق الملكية',whatsappNumber:'رقم واتساب',
  bookingStep1Title:'عنوان خطوة 1',bookingStep1Sub:'وصف خطوة 1',bookingStep2Title:'عنوان خطوة 2',
  bookingStep3Title:'عنوان خطوة 3',bookingStep3Sub:'وصف خطوة 3',
  bookingConfirmTitle:'عنوان التأكيد',bookingConfirmSub:'وصف التأكيد',paymentSafeText:'نص الدفع الآمن',
  giftEyebrow:'Eyebrow',giftTitle:'العنوان',giftSubtitle:'العنوان الفرعي',
  membershipsEyebrow:'Eyebrow',membershipsTitle:'العنوان',membershipsSub:'الوصف',
  logoText:'نص الشعار',vatNumber:'الرقم الضريبي'
};
function renderTexts(){
  const tx=DB.texts||{};
  g('texts-editor').innerHTML=TEXT_GROUPS.map(grp=>\`
    <div class="text-group">
      <div class="text-group-ttl">\${grp.title}</div>
      \${grp.keys.map(k=>\`
        <div class="text-row">
          <span class="text-lbl">\${TEXT_LABELS[k]||k}</span>
          <input class="text-inp" data-key="\${k}" value="\${e(tx[k]||'')}" placeholder="\${TEXT_LABELS[k]||k}">
        </div>\`).join('')}
    </div>\`).join('');
}
function collectTexts(){
  DB.texts=DB.texts||{};
  document.querySelectorAll('.text-inp').forEach(inp=>{DB.texts[inp.dataset.key]=inp.value;});
}

// ── MENU ──
function renderMenu(){
  const cats=(DB.categories||[]).sort((a,b)=>a.order-b.order);
  if(!cats.length){g('cats-list').innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.3);padding:8px 0">لا توجد أقسام بعد.</div>';return;}
  g('cats-list').innerHTML=cats.map((cat,i)=>{
    const svcs=(DB.services||[]).filter(s=>s.categoryId===cat.id);
    const subCount=(cat.subSections||[]).length;
    const svcSummary=svcs.length?svcs.map(s=>s.nameAr||s.rekazPriceId).slice(0,4).join('، ')+(svcs.length>4?'...':''):'لا توجد خدمات';
    return \`<div class="li" draggable="true" data-id="\${cat.id}" ondragstart="drs(event,'\${cat.id}')" ondragover="ev.preventDefault&&ev.preventDefault()" ondrop="drp(event,'\${cat.id}')">
      <span class="dh">⠿</span>
      <div class="li-info">
        <div class="li-name">\${e(cat.nameAr)} <span style="color:rgba(255,255,255,.3);font-size:11px">/ \${e(cat.nameEn||'')}</span></div>
        <div class="li-sub">\${subCount} قسم فرعي · \${svcs.length} خدمة — \${e(svcSummary)}</div>
      </div>
      <div class="li-acts">
        <div class="tog \${cat.visible!==false?'on':''}" onclick="togCat('\${cat.id}')"></div>
        <button class="lb" onclick="openCatModal('\${cat.id}')">تعديل</button>
        <button class="lb del" onclick="delCat('\${cat.id}')">حذف</button>
      </div></div>\`;
  }).join('');
  renderOverview();
}
let dragId=null;
function drs(ev,id){dragId=id;}
function drp(ev,id){
  ev.preventDefault();if(!dragId||dragId===id)return;
  const cats=DB.categories;const fi=cats.findIndex(c=>c.id===dragId);const ti=cats.findIndex(c=>c.id===id);
  const [m]=cats.splice(fi,1);cats.splice(ti,0,m);cats.forEach((c,i)=>c.order=i+1);
  dragId=null;renderMenu();api('PUT','/admin/categories-order',{order:cats.map(c=>c.id)});
}
function togCat(id){const cat=DB.categories.find(c=>c.id===id);if(cat)cat.visible=!(cat.visible!==false);renderMenu();}
function delCat(id){
  if(!confirm('سيتم حذف القسم وجميع خدماته. متأكدة؟'))return;
  DB.categories=DB.categories.filter(c=>c.id!==id);
  DB.services=DB.services.filter(s=>s.categoryId!==id);
  renderMenu();api('DELETE','/admin/categories/'+id);
}

// ── CAT MODAL ──
function openCatModal(id){
  editCatId=id||null;
  const cat=id?DB.categories.find(c=>c.id===id):null;
  g('cat-modal-ttl').textContent=cat?'تعديل: '+cat.nameAr:'قسم جديد';
  setv('cm-ar',cat?.nameAr||'');setv('cm-en',cat?.nameEn||'');
  subSections=JSON.parse(JSON.stringify(cat?.subSections||[]));
  if(!subSections.length) subSections=[{name:'',services:[]}]; // at least 1
  renderSubSections();
  g('cat-modal').classList.add('on');
}
function closeModal(){g('cat-modal').classList.remove('on');editCatId=null;}

// ── SUB SECTIONS ──
function renderSubSections(){
  g('sub-sections-editor').innerHTML=subSections.map((sub,si)=>{
    const linkedIds=sub.services||[];
    return \`<div class="sub-editor">
      <div class="sub-editor-ttl">
        <input style="background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.15);color:#fff;font-family:'Tajawal',sans-serif;font-size:13px;padding:3px 0;width:70%" 
          placeholder="اسم القسم الفرعي (مثال: MANICURE · مناكير)" 
          value="\${esc(sub.name||'')}" 
          oninput="subSections[\${si}].name=this.value">
        \${subSections.length>1?\`<button class="lb del" onclick="removeSub(\${si})">حذف القسم الفرعي</button>\`:''}
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,.35);margin-bottom:7px">اختاري الخدمات لهذا القسم الفرعي:</div>
      <input class="rp-search" placeholder="بحث..." oninput="filterSub(\${si},this.value)" style="margin-bottom:6px">
      <div class="rp-list" id="sub-list-\${si}">
        \${renderSubPicker(si,linkedIds,'')}
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:5px" id="sub-count-\${si}">\${linkedIds.length} خدمة مختارة</div>
    </div>\`;
  }).join('');
}
function renderSubPicker(si,selectedIds,q){
  const prods=q?rekazProds.filter(p=>((p.nameAr||p.name||'')+(p.nameEn||'')).toLowerCase().includes(q.toLowerCase())):rekazProds;
  if(!prods.length)return '<div style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.3)">لا توجد نتائج</div>';
  return prods.map(p=>{
    const name=(p.nameAr||p.name||'').split(' - ')[0].trim();
    const hasV=p.pricing&&p.pricing.length>1;
    if(hasV){
      return p.pricing.map(pr=>{
        const sel=selectedIds.includes(pr.id)?'sel':'';
        return \`<div class="rp-item \${sel}" onclick="togSubItem(\${si},'\${pr.id}','\${pr.id}','\${esc(name)} — \${esc(pr.name||'')}',this)">
          <div class="rp-chk"><div class="rp-chk-i"></div></div>
          <span class="rp-name">\${e(name)} — \${e(pr.name||'')}</span>
          <span class="rp-price">SAR \${pr.amount||0}</span>
        </div>\`;
      }).join('');
    }
    const priceId=(p.pricing&&p.pricing[0])?p.pricing[0].id:p.id;
    const sel=selectedIds.includes(priceId)?'sel':'';
    return \`<div class="rp-item \${sel}" onclick="togSubItem(\${si},'\${priceId}','\${p.id}','\${esc(name)}',this)">
      <div class="rp-chk"><div class="rp-chk-i"></div></div>
      <span class="rp-name">\${e(name)}</span>
      <span class="rp-price">SAR \${p.amount||0}</span>
    </div>\`;
  }).join('');
}
function filterSub(si,q){
  const el=g('sub-list-'+si);if(!el)return;
  const selectedIds=subSections[si].services||[];
  el.innerHTML=renderSubPicker(si,selectedIds,q);
}
function togSubItem(si,priceId,productId,name,el){
  el.classList.toggle('sel');
  const svc=subSections[si].services=subSections[si].services||[];
  const idx=svc.indexOf(priceId);
  if(idx>-1)svc.splice(idx,1);else svc.push(priceId);
  // Store full info for server
  subSections[si].serviceDetails=subSections[si].serviceDetails||{};
  subSections[si].serviceDetails[priceId]={priceId,productId,nameAr:name};
  const cnt=g('sub-count-'+si);if(cnt)cnt.textContent=svc.length+' خدمة مختارة';
}
function addSubSection(){
  subSections.push({name:'',services:[],serviceDetails:{}});
  renderSubSections();
}
function removeSub(si){
  subSections.splice(si,1);
  renderSubSections();
}

async function saveCat(){
  const ar=g('cm-ar').value.trim();if(!ar){alert('أدخلي اسم القسم');return;}
  const payload={nameAr:ar,nameEn:g('cm-en').value.trim(),subSections};
  if(!editCatId){
    payload.order=DB.categories.length+1;
    const cat=await api('POST','/admin/categories',payload);
    DB.categories.push(cat);editCatId=cat.id;
  }else{
    await api('PUT','/admin/categories/'+editCatId,payload);
    const cat=DB.categories.find(c=>c.id===editCatId);if(cat)Object.assign(cat,payload);
  }
  // Save all services from all sub-sections
  const allPriceIds=[];
  subSections.forEach(sub=>{
    const details=sub.serviceDetails||{};
    (sub.services||[]).forEach((pid,idx)=>{
      const d=details[pid]||{};
      allPriceIds.push({rekazPriceId:pid,rekazProductId:d.productId||null,nameAr:d.nameAr||''});
    });
  });
  await api('PUT',\`/admin/categories/\${editCatId}/services\`,{priceIds:allPriceIds});
  DB.services=DB.services.filter(s=>s.categoryId!==editCatId);
  allPriceIds.forEach((item,idx)=>{
    DB.services.push({id:'srv_'+Date.now()+idx,rekazPriceId:item.rekazPriceId,rekazProductId:item.rekazProductId,categoryId:editCatId,nameAr:item.nameAr,order:idx+1,visible:true});
  });
  closeModal();renderMenu();
}

// ── BUTTONS ──
function renderButtons(){
  const btns=(DB.buttons||[]).sort((a,b)=>a.order-b.order);
  const actions=['booking','gift','memberships','whatsapp'];
  const actionLabels={booking:'حجز',gift:'إهداء',memberships:'عضويات',whatsapp:'واتساب'};
  const styles=['primary','outline'];
  g('btns-list').innerHTML=btns.map((b,i)=>\`
    <div class="li">
      <span class="dh" style="cursor:default">⠿</span>
      <div class="li-info" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <input style="background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.15);color:#fff;font-family:'Tajawal',sans-serif;font-size:13px;padding:4px 0;min-width:130px;flex:1;outline:none"
          value="\${e(b.textAr||'')}" onchange="DB.buttons[\${i}].textAr=this.value" placeholder="نص الزر">
        <select style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);font-family:'Tajawal',sans-serif;font-size:11px;padding:4px 6px;outline:none" onchange="DB.buttons[\${i}].action=this.value">
          \${actions.map(a=>\`<option value="\${a}"\${b.action===a?' selected':''}>\${actionLabels[a]}</option>\`).join('')}
        </select>
        <select style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.6);font-family:'Tajawal',sans-serif;font-size:11px;padding:4px 6px;outline:none" onchange="DB.buttons[\${i}].style=this.value">
          \${styles.map(s=>\`<option value="\${s}"\${b.style===s?' selected':''}>\${s==='primary'?'ذهبي':'شفاف'}</option>\`).join('')}
        </select>
      </div>
      <div class="li-acts">
        <div class="tog \${b.visible!==false?'on':''}" onclick="togBtn(\${i})"></div>
        <button class="lb del" onclick="delBtn(\${i})">×</button>
      </div>
    </div>\`).join('');
}
function togBtn(i){DB.buttons[i].visible=!(DB.buttons[i].visible!==false);renderButtons();}
function delBtn(i){if(!confirm('حذف الزر؟'))return;DB.buttons.splice(i,1);renderButtons();}
function addBtn(){
  DB.buttons=DB.buttons||[];
  DB.buttons.push({id:'btn_'+Date.now(),textAr:'زر جديد',action:'booking',style:'outline',order:DB.buttons.length+1,visible:true});
  renderButtons();
}

// ── DESIGN ──
function renderDesign(){
  const t=DB.theme||{};
  setc('c-gold',t.primaryColor||'#b8965a');setc('c-ink',t.bgDark||'#080807');
  setc('c-light',t.bgLight||'#f3ede3');setc('c-text',t.textColor||'#17150e');
  ['gold','ink','light','text'].forEach(k=>g('sw-'+k).style.background=g('c-'+k).value);
  setSel('f-arabic',t.fontArabic||'Tajawal');setSel('f-display',t.fontDisplay||'Cormorant Garamond');
  setv('c-brad',t.borderRadius||0);g('brad-lbl').textContent=t.borderRadius||0;
  setv('c-sub-en',t.subEnSize||26);g('sub-en-lbl').textContent=t.subEnSize||26;
  setv('c-sub-ar',t.subArSize||22);g('sub-ar-lbl').textContent=t.subArSize||22;
  prevFont();
}
function prevFont(){
  const f=g('f-arabic').value;
  let lnk=document.getElementById('gfl');
  if(!lnk){lnk=document.createElement('link');lnk.id='gfl';lnk.rel='stylesheet';document.head.appendChild(lnk);}
  lnk.href=\`https://fonts.googleapis.com/css2?family=\${encodeURIComponent(f)}:wght@400&display=swap\`;
  g('fp').style.fontFamily=\`'\${f}',sans-serif\`;
}
function collectDesign(){
  DB.theme={...DB.theme,
    primaryColor:g('c-gold').value,bgDark:g('c-ink').value,
    bgLight:g('c-light').value,textColor:g('c-text').value,
    fontArabic:g('f-arabic').value,fontDisplay:g('f-display').value,
    borderRadius:parseInt(g('c-brad').value)||0,
    subEnSize:parseInt(g('c-sub-en').value)||26,
    subArSize:parseInt(g('c-sub-ar').value)||22
  };
}

// ── LOGO ──
function renderLogo(){
  const l=DB.layout||{},t=DB.theme||{};
  setv('l-logo',l.logoText||'GRAFF SPA');
  setc('c-acc',t.logoAccent||'#b8965a');g('sw-acc').style.background=t.logoAccent||'#b8965a';
  if(l.logoImage)g('logo-prev').innerHTML=\`<img src="\${l.logoImage}" style="max-height:54px;max-width:160px;object-fit:contain">\`;
}
function uploadLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{DB.layout=DB.layout||{};DB.layout.logoImage=ev.target.result;g('logo-prev').innerHTML=\`<img src="\${ev.target.result}" style="max-height:54px;max-width:160px;object-fit:contain">\`;};
  reader.readAsDataURL(file);
}
function clearLogo(){if(DB.layout)DB.layout.logoImage='';g('logo-prev').innerHTML='<span style="font-size:12px;color:rgba(255,255,255,.3)">لا توجد صورة</span>';}
function collectLogo(){
  DB.layout=DB.layout||{};DB.layout.logoText=g('l-logo').value;
  DB.theme=DB.theme||{};DB.theme.logoAccent=g('c-acc').value;
}

// ── GIFT ──
function renderGift(){
  const gp=(DB.pages&&DB.pages.gift)||{};
  setv('gc-title',gp.title||'بطاقة الإهداء');setv('gc-subtitle',gp.subtitle||'');
  setv('gc-amounts',(gp.amounts||[200,300,500,1000]).join(','));
}
function collectGift(){
  DB.pages=DB.pages||{};DB.pages.gift=DB.pages.gift||{};
  DB.pages.gift.title=g('gc-title').value;DB.pages.gift.subtitle=g('gc-subtitle').value;
  DB.pages.gift.amounts=(g('gc-amounts').value||'').split(',').map(x=>parseInt(x.trim())).filter(Boolean);
}

// ── MEMBERSHIPS ──
function renderMems(){
  const mems=(DB.pages&&DB.pages.memberships&&DB.pages.memberships.items)||[];
  g('mems-list').innerHTML=mems.map((m,i)=>\`
    <div class="mem-edit">
      <div class="mem-edit-ttl"><span>\${e(m.name||'باقة')}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:10px;color:rgba(255,255,255,.4)">مميز</label>
          <div class="tog \${m.featured?'on':''}" onclick="DB.pages.memberships.items[\${i}].featured=!DB.pages.memberships.items[\${i}].featured;this.classList.toggle('on')"></div>
          <button class="lb del" onclick="delMem(\${i})">×</button>
        </div>
      </div>
      <div class="gr3">
        <div class="f"><label>الاسم</label><input value="\${e(m.name||'')}" onchange="DB.pages.memberships.items[\${i}].name=this.value"></div>
        <div class="f"><label>السعر SAR</label><input type="number" value="\${m.price||0}" onchange="DB.pages.memberships.items[\${i}].price=parseInt(this.value)||0"></div>
        <div class="f"><label>عدد الزيارات</label><input type="number" value="\${m.visits||12}" onchange="DB.pages.memberships.items[\${i}].visits=parseInt(this.value)||12"></div>
      </div>
      <div class="f"><label>المميزات (كل سطر ميزة)</label>
        <textarea onchange="DB.pages.memberships.items[\${i}].features=this.value.split('\\\\n').filter(Boolean)">\${e((m.features||[]).join('\\n'))}</textarea>
      </div>
    </div>\`).join('');
}
function addMem(){
  if(!DB.pages)DB.pages={};if(!DB.pages.memberships)DB.pages.memberships={items:[]};
  if(!DB.pages.memberships.items)DB.pages.memberships.items=[];
  DB.pages.memberships.items.push({name:'باقة جديدة',price:0,featured:false,visits:12,features:[]});
  renderMems();
}
function delMem(i){DB.pages.memberships.items.splice(i,1);renderMems();}
function collectMems(){}

// ── SOCIAL ──
function renderSocial(){
  const s=DB.social||{};
  setv('s-ig',s.instagram_user||s.instagram?.replace('https://instagram.com/','').replace('https://www.instagram.com/','')||'');
  setv('s-tt',s.tiktok_user||s.tiktok?.replace('https://tiktok.com/@','').replace('https://www.tiktok.com/@','')||'');
  setv('s-sc',s.snapchat_user||s.snapchat?.replace('https://snapchat.com/add/','')||'');
  setv('s-tw',s.twitter_user||s.twitter?.replace('https://x.com/','').replace('https://twitter.com/','')||'');
  setv('s-wa',s.whatsapp||'');
}
function collectSocial(){
  const clean=v=>v.trim().replace(/^@/,'').replace(/.*\\//,'');
  const ig=clean(g('s-ig').value);const tt=clean(g('s-tt').value);
  const sc=clean(g('s-sc').value);const tw=clean(g('s-tw').value);
  const wa=g('s-wa').value.trim().replace(/\\D/g,'');
  DB.social={
    instagram_user:ig, instagram:ig?\`https://instagram.com/\${ig}\`:'',
    tiktok_user:tt,    tiktok:tt?\`https://tiktok.com/@\${tt}\`:'',
    snapchat_user:sc,  snapchat:sc?\`https://snapchat.com/add/\${sc}\`:'',
    twitter_user:tw,   twitter:tw?\`https://x.com/\${tw}\`:'',
    whatsapp:wa
  };
}

// ── PAYMENT ──
function renderPayment(){
  const pays=(DB.payments||[]).sort((a,b)=>a.order-b.order);
  g('pay-list').innerHTML=pays.map((p,i)=>{
    const img=p.customImage?\`<img src="\${p.customImage}" style="height:22px;max-width:60px;object-fit:contain;background:#fff;padding:2px 4px;border-radius:3px">\`:'<span style="font-size:11px;color:rgba(255,255,255,.3)">افتراضي</span>';
    return \`<div class="li">
      <div class="li-info">
        <div class="li-name">\${e(p.label)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
          \${img}
          <label style="font-size:10px;color:var(--gold);cursor:pointer;border:1px solid rgba(184,150,90,.3);padding:3px 8px">رفع صورة<input type="file" accept="image/*" style="display:none" onchange="uploadPay(\${i},this)"></label>
          \${p.customImage?\`<button class="lb" style="padding:3px 7px" onclick="clearPay(\${i})">حذف</button>\`:''}
          \${i>5?\`<button class="lb del" onclick="delPay(\${i})">×</button>\`:''}
        </div>
      </div>
      <div class="tog \${p.visible!==false?'on':''}" onclick="togPay(\${i})"></div>
    </div>\`;
  }).join('');
}
function togPay(i){DB.payments[i].visible=!(DB.payments[i].visible!==false);renderPayment();}
function delPay(i){DB.payments.splice(i,1);renderPayment();}
function addPay(){DB.payments.push({id:'pay_'+Date.now(),label:'بوابة جديدة',visible:true,order:DB.payments.length+1,customImage:''});renderPayment();}
function uploadPay(i,input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{DB.payments[i].customImage=ev.target.result;renderPayment();};r.readAsDataURL(f);}
function clearPay(i){DB.payments[i].customImage='';renderPayment();}


// ── POLICIES ──

function renderPolicies(){
  var pol=DB.policies||{};
  var el=document.getElementById('pol-ar');
  if(el)el.value=pol.ar||'';
}

async function savePolicies(){
  DB.policies={ar:(document.getElementById('pol-ar').value||''),en:''};
  await api('PUT','/admin/policies',DB.policies);
  flash();
}



</script>
</body>
</html>
`;
app.get("/", (req,res) => res.send("GRAFF SPA API ✅"));
app.get("/admin", (req,res) => { res.setHeader("Content-Type","text/html; charset=utf-8"); res.send(ADMIN_HTML); });
app.get("/admin", (req,res) => {
  try {
    const html = readFileSync(process.cwd()+"/admin.html","utf8");
    res.setHeader("Content-Type","text/html");
    res.send(html);
  } catch(e) {
    res.status(404).send("admin.html not found. Make sure admin.html is in the same folder as server.js");
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
    policies: db.policies||{ar:'',en:''}
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
