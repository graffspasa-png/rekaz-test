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

const REKAZ_API  = "https://platform.rekaz.io/api/public";
const RH = () => ({
  "Authorization": `Basic ${process.env.REKAZ_AUTH}`,
  "__tenant": process.env.REKAZ_TENANT_ID,
  "Content-Type": "application/json"
});
const BRANCH_ID  = process.env.REKAZ_BRANCH_ID;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "graff2026";

const DB_PATH = "./db.json";
async function readDB() {
  try { return JSON.parse(readFileSync(DB_PATH, "utf8")); }
  catch(e) { return { site:{}, menu:[], bookings:[] }; }
}
async function writeDB(data) { writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// ── مسار شراء بطاقة الإهداء ──
app.post("/api/purchase-gift", async (req, res) => {
  try {
    const { amount, senderName, recipientName, recipientPhone } = req.body;
    const GIFT_PRICE_ID = "3a1cf597-90c7-0346-6330-80d0d829928d";

    const payload = {
      customerDetails: { name: senderName, mobileNumber: "+966500000000", type: 1 },
      branchId: BRANCH_ID,
      items: [{
        quantity: 1,
        priceId: GIFT_PRICE_ID,
        from: new Date().toISOString(),
        to: new Date(Date.now() + 3600000).toISOString(), 
        customFields: {
          "المُرسل": senderName,
          "المُستلم": recipientName,
          "جوال المستلم": recipientPhone,
          "المبلغ": amount
        }
      }]
    };

    const response = await fetch(`${REKAZ_API}/reservations/bulk`, {
      method: "POST",
      headers: RH(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.paymentLink) {
      res.json({ success: true, paymentLink: data.paymentLink });
    } else {
      throw new Error(data.error?.message || "فشل إصدار رابط الدفع");
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/site", async(req,res)=>{
  const db=await readDB();
  res.json(db.site||{});
});

app.get("/api/menu", async(req,res)=>{
  try {
    const r=await fetch(`${REKAZ_API}/products/categories?branchId=${BRANCH_ID}`, { headers:RH() });
    const d=await r.json();
    res.json(d);
  } catch(e) { res.status(500).json({error:e.message}); }
});

const adminAuth = (req,res,next)=>{
  const auth=req.headers.authorization;
  if(auth===`Bearer ${ADMIN_PASS}`) return next();
  res.status(401).json({error:"Unauthorized"});
};

app.post("/admin/login", (req,res)=>{
  if(req.body.password===ADMIN_PASS) res.json({success:true,token:ADMIN_PASS});
  else res.status(401).json({error:"Wrong password"});
});

app.get("/admin/db", adminAuth, async(req,res)=>{
  res.json(await readDB());
});

app.post("/admin/update-site", adminAuth, async(req,res)=>{
  const db=await readDB();
  db.site = Object.assign(db.site||{}, req.body);
  await writeDB(db);
  res.json({success:true});
});

app.listen(process.env.PORT || 3000, () => console.log("Server running..."));
