import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// 🔐 Rekaz
const AUTH = process.env.REKAZ_AUTH;
const TENANT_ID = process.env.REKAZ_TENANT_ID;

const BASE_URL = "https://platform.rekaz.io/api/public";

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Booking System Ready ✅");
});


// 📦 جلب المنتجات
app.get("/products", async (req, res) => {
  const r = await fetch(`${BASE_URL}/products`, {
    headers: {
      Authorization: AUTH,
      "__tenant": TENANT_ID
    }
  });

  const data = await r.json();
  res.json(data);
});


// 👤 إنشاء عميل
app.post("/create-customer", async (req, res) => {
  try {
    const body = {
      name: req.body.name,
      mobileNumber: req.body.mobile,
      email: "",
      type: 1,
      branchId: req.body.branchId
    };

    const r = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    res.send(text);

  } catch (e) {
    res.send(e.message);
  }
});


// 📅 جلب المواعيد
app.get("/slots", async (req, res) => {
  const { priceId } = req.query;

  const url = `${BASE_URL}/reservations/slots?StartDate=2025-04-01T10:00:00&EndDate=2025-04-05T22:00:00&PriceId=${priceId}&MinQuantity=1`;

  const r = await fetch(url, {
    headers: {
      Authorization: AUTH,
      "__tenant": TENANT_ID
    }
  });

  const data = await r.json();
  res.json(data);
});


// 🧾 إنشاء حجز
app.post("/create-booking", async (req, res) => {
  try {
    const body = {
      customerDetails: {
        name: req.body.name,
        mobileNumber: req.body.mobile,
        email: "",
        type: 1,
        companyName: ""
      },
      branchId: req.body.branchId,
      items: [
        {
          quantity: 1,
          priceId: req.body.priceId,
          from: req.body.from,
          to: req.body.to,
          providerIds: [],
          customFields: {},
          discount: {
            type: "percentage",
            value: 0
          }
        }
      ]
    };

    const r = await fetch(`${BASE_URL}/reservations/bulk`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "__tenant": TENANT_ID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    res.send(text);

  } catch (e) {
    res.send(e.message);
  }
});


// 🌐 صفحة حجز كاملة
app.get("/book", async (req, res) => {

  const r = await fetch(`${BASE_URL}/products`, {
    headers: {
      Authorization: AUTH,
      "__tenant": TENANT_ID
    }
  });

  const data = await r.json();
  const products = data.items || data;

  let html = `
  <html>
  <body>
  <h1>احجز الآن</h1>

  <form method="POST" action="/create-booking">
    <input name="name" placeholder="اسمك" required/><br><br>
    <input name="mobile" placeholder="رقمك" required/><br><br>

    <select name="priceId">
  `;

  products.forEach(p => {
    if (p.pricing && p.pricing.length > 0) {
      p.pricing.forEach(price => {
        html += `<option value="${price.id}">
          ${p.name} - ${price.amount} ريال
        </option>`;
      });
    }
  });

  html += `
    </select><br><br>

    <input name="branchId" placeholder="branchId" required/><br><br>

    <input name="from" placeholder="2025-04-01T10:00:00Z" required/><br><br>
    <input name="to" placeholder="2025-04-01T11:00:00Z" required/><br><br>

    <button type="submit">احجز</button>
  </form>

  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, () => {
  console.log("Server running 🚀");
});
