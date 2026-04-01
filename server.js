import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const BASE_URL = "https://platform.rekaz.io/api/public";

// 🔴 حط بياناتك هنا
const AUTH = "Basic YOUR_BASE64_KEY";
const TENANT = "3a1d7f2c-2ad3-ce53-aad1-80f155af75c8";

// ================= الصفحة الرئيسية =================
app.get("/", (req, res) => {
  res.send(`
  <html dir="rtl">
  <head>
    <meta charset="UTF-8">
    <title>نظام الحجز</title>
  </head>
  <body>
    <h2>📦 المنتجات</h2>
    <select id="products"></select>

    <h2>📅 التاريخ</h2>
    <input type="date" id="date">

    <button onclick="loadSlots()">عرض الأوقات</button>

    <h2>⏰ الأوقات</h2>
    <div id="slots"></div>

    <h2>👤 العميل</h2>
    <input id="name" placeholder="الاسم">
    <input id="phone" placeholder="الجوال">

    <button onclick="book()">احجز</button>

    <script>
    let priceId = null;
    let selectedSlot = null;

    async function loadProducts(){
      const res = await fetch('/products');
      const data = await res.json();

      const select = document.getElementById("products");

      data.items.forEach(p=>{
        const op = document.createElement("option");
        op.value = p.pricing[0].id;
        op.textContent = p.name;
        select.appendChild(op);
      });

      priceId = select.value;
    }

    document.getElementById("products").onchange = e=>{
      priceId = e.target.value;
    }

    async function loadSlots(){
      const res = await fetch('/slots?priceId=' + priceId);
      const data = await res.json();

      const div = document.getElementById("slots");
      div.innerHTML = "";

      data.forEach(s=>{
        if(s.isAvailable){
          const el = document.createElement("div");
          el.innerText = s.from;
          el.style.cursor = "pointer";

          el.onclick = ()=>{
            selectedSlot = s;
            alert("تم اختيار الوقت");
          };

          div.appendChild(el);
        }
      });
    }

    async function book(){
      const name = document.getElementById("name").value;
      const phone = document.getElementById("phone").value;

      // إنشاء عميل
      const c = await fetch('/customer', {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          name: name,
          mobileNumber: phone,
          type: 1
        })
      });

      const customerId = await c.text();

      // حجز
      const r = await fetch('/reserve', {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          customerId: customerId,
          branchId: "PUT_BRANCH_ID_HERE",
          items: [{
            quantity: 1,
            priceId: priceId,
            from: selectedSlot.from,
            to: selectedSlot.to
          }]
        })
      });

      alert("تم الحجز 🔥");
    }

    loadProducts();
    </script>

  </body>
  </html>
  `);
});

// ================= المنتجات =================
app.get("/products", async (req, res) => {
  const r = await fetch(BASE_URL + "/products", {
    headers: {
      Authorization: AUTH,
      __tenant: TENANT
    }
  });
  res.send(await r.text());
});

// ================= الأوقات =================
app.get("/slots", async (req, res) => {
  const { priceId } = req.query;

  const url = BASE_URL + "/reservations/slots?StartDate=2025-04-01T10:00:00&EndDate=2025-04-05T22:00:00&PriceId=" + priceId + "&MinQuantity=1";

  const r = await fetch(url, {
    headers: {
      Authorization: AUTH,
      __tenant: TENANT
    }
  });

  res.send(await r.text());
});

// ================= عميل =================
app.post("/customer", async (req, res) => {
  const r = await fetch(BASE_URL + "/customers", {
    method: "POST",
    headers: {
      Authorization: AUTH,
      __tenant: TENANT,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(req.body)
  });

  res.send(await r.text());
});

// ================= حجز =================
app.post("/reserve", async (req, res) => {
  const r = await fetch(BASE_URL + "/reservations/bulk", {
    method: "POST",
    headers: {
      Authorization: AUTH,
      __tenant: TENANT,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(req.body)
  });

  res.send(await r.text());
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running 🔥");
});
