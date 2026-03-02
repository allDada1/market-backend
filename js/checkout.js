// checkout.js — оформление заказа (local demo) + защита входом

// Должно совпадать с товарами на главной/в корзине
const PRODUCTS = [
  { id: 1, title: "Смарт-часы Pulse Mini", desc: "Лёгкие, автономные, серый корпус.", price: 18990, cat: "Гаджеты" },
  { id: 2, title: "Клавиатура Neo 60", desc: "Компактная, тихие клавиши, подсветка.", price: 23990, cat: "Компьютеры" },
  { id: 3, title: "Наушники AirWave", desc: "Чистый звук, мягкие амбушюры.", price: 15990, cat: "Аудио" },
  { id: 4, title: "Рюкзак Urban Slate", desc: "Минимализм, защита ноутбука, влагостойкий.", price: 12990, cat: "Аксессуары" },
  { id: 5, title: "Мышь Glide Pro", desc: "Лёгкая, точная, без лишнего шума.", price: 9990, cat: "Компьютеры" },
  { id: 6, title: "Лампа Desk Calm", desc: "Тёплый свет, сенсор, регулировка.", price: 10990, cat: "Дом" },
  { id: 7, title: "Повербанк Stone 20k", desc: "20 000 мАч, быстрый заряд, строгий дизайн.", price: 14990, cat: "Гаджеты" },
  { id: 8, title: "Термокружка Steel 500", desc: "Держит тепло, матовый металл.", price: 7990, cat: "Дом" },
];

const el = {
  userMeta: document.getElementById("userMeta"),

  city: document.getElementById("city"),
  phone: document.getElementById("phone"),
  address: document.getElementById("address"),
  comment: document.getElementById("comment"),

  payBox: document.getElementById("payBox"),
  cardNum: document.getElementById("cardNum"),
  cardName: document.getElementById("cardName"),
  cardExp: document.getElementById("cardExp"),
  cardCvv: document.getElementById("cardCvv"),

  miniList: document.getElementById("miniList"),
  itemsSum: document.getElementById("itemsSum"),
  deliverySum: document.getElementById("deliverySum"),
  paySum: document.getElementById("paySum"),

  place: document.getElementById("placeOrderBtn"),
  note: document.getElementById("formNote"),
  tiny: document.getElementById("tinyInfo"),
};

function formatKZT(value){
  const s = String(Math.round(value));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced} ₸`;
}

function getSession(){
  try{
    const raw = localStorage.getItem("market_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    if (typeof s.email !== "string" || typeof s.name !== "string") return null;
    return s;
  }catch{
    return null;
  }
}

function loadCart(){
  try{ return JSON.parse(localStorage.getItem("market_cart") || "{}"); }
  catch{ return {}; }
}

function saveOrders(orders){
  localStorage.setItem("market_orders", JSON.stringify(orders));
}
function loadOrders(){
  try{ return JSON.parse(localStorage.getItem("market_orders") || "[]"); }
  catch{ return []; }
}

function getDeliveryPrice(code){
  if (code === "courier") return 1490;
  if (code === "express") return 2990;
  return 0; // pickup
}

function getProduct(id){
  return PRODUCTS.find(p => p.id === id) || null;
}

function cartCount(cart){
  return Object.values(cart).reduce((a,b) => a + (Number(b)||0), 0);
}

const session = getSession();
if (!session){
  window.location.href = "login.html";
}

const cart = loadCart();
if (cartCount(cart) <= 0){
  // если корзина пустая — смысла оформлять нет
  window.location.href = "cart.html";
}

el.userMeta.textContent = `${session.name} • ${session.email}`;
el.tiny.textContent = "Данные и “оплата” сохраняются только локально (для демонстрации диплома).";

// ---- pay box toggle ----
function currentPayMethod(){
  const r = document.querySelector('input[name="pay"]:checked');
  return r ? r.value : "card";
}
function updatePayBox(){
  const method = currentPayMethod();
  el.payBox.style.display = method === "card" ? "grid" : "none";
}
document.querySelectorAll('input[name="pay"]').forEach(r => {
  r.addEventListener("change", updatePayBox);
});
updatePayBox();

// ---- totals ----
function currentDeliveryMethod(){
  const r = document.querySelector('input[name="delivery"]:checked');
  return r ? r.value : "courier";
}

function computeItemsSubtotal(){
  let s = 0;
  Object.keys(cart).forEach(k => {
    const id = Number(k);
    const qty = Number(cart[k] || 0);
    const p = getProduct(id);
    if (p && qty > 0) s += p.price * qty;
  });
  return s;
}

function renderMiniList(){
  el.miniList.innerHTML = "";
  Object.keys(cart).forEach(k => {
    const id = Number(k);
    const qty = Number(cart[k] || 0);
    const p = getProduct(id);
    if (!p || qty <= 0) return;

    const row = document.createElement("div");
    row.className = "mini";
    row.innerHTML = `<span>${p.title} <b>×${qty}</b></span><span>${formatKZT(p.price * qty)}</span>`;
    el.miniList.appendChild(row);
  });
}

function renderTotals(){
  const items = computeItemsSubtotal();
  const del = getDeliveryPrice(currentDeliveryMethod());
  const total = items + del;

  el.itemsSum.textContent = formatKZT(items);
  el.deliverySum.textContent = formatKZT(del);
  el.paySum.textContent = formatKZT(total);
}

document.querySelectorAll('input[name="delivery"]').forEach(r => {
  r.addEventListener("change", renderTotals);
});

renderMiniList();
renderTotals();

// ---- validation ----
function setNote(text){
  el.note.textContent = text || "";
}

function isValidPhone(v){
  const digits = String(v).replace(/\D/g, "");
  // Казахстан/РФ формат: минимум 10-11 цифр — достаточно для демо
  return digits.length >= 10;
}

function validateForm(){
  const city = el.city.value.trim();
  const phone = el.phone.value.trim();
  const address = el.address.value.trim();

  if (!city){ setNote("Укажи город."); return false; }
  if (!isValidPhone(phone)){ setNote("Телефон выглядит странно. Проверь цифры."); return false; }

  const delivery = currentDeliveryMethod();
  if (delivery !== "pickup" && !address){
    setNote("Для доставки нужен адрес.");
    return false;
  }

  const pay = currentPayMethod();
  if (pay === "card"){
    const num = el.cardNum.value.replace(/\s/g, "");
    const name = el.cardName.value.trim();
    const exp = el.cardExp.value.trim();
    const cvv = el.cardCvv.value.trim();

    if (num.length < 12){ setNote("Номер карты слишком короткий (макет, но всё же)."); return false; }
    if (!name){ setNote("Укажи имя на карте."); return false; }
    if (!exp || !exp.includes("/")){ setNote("Срок карты в формате MM/YY."); return false; }
    if (cvv.replace(/\D/g,"").length < 3){ setNote("CVV должен быть минимум 3 цифры."); return false; }
  }

  setNote("");
  return true;
}

// ---- place order ----
function generateOrderId(){
  const now = new Date();
  const t = now.getTime();
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `MK-${t}-${rnd}`;
}

el.place.addEventListener("click", () => {
  if (!validateForm()) return;

  const items = [];
  Object.keys(cart).forEach(k => {
    const id = Number(k);
    const qty = Number(cart[k] || 0);
    const p = getProduct(id);
    if (!p || qty <= 0) return;
    items.push({ id: p.id, title: p.title, price: p.price, qty });
  });

  const itemsSubtotal = computeItemsSubtotal();
  const deliveryMethod = currentDeliveryMethod();
  const deliveryPrice = getDeliveryPrice(deliveryMethod);
  const payMethod = currentPayMethod();
  const total = itemsSubtotal + deliveryPrice;

  const order = {
    id: generateOrderId(),
    createdAt: new Date().toISOString(),
    user: { name: session.name, email: session.email },
    delivery: {
      method: deliveryMethod,
      city: el.city.value.trim(),
      phone: el.phone.value.trim(),
      address: el.address.value.trim(),
      price: deliveryPrice,
    },
    payment: { method: payMethod },
    comment: el.comment.value.trim(),
    items,
    subtotal: itemsSubtotal,
    total,
    status: "created",
  };

  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);

  // очистим корзину
  localStorage.removeItem("market_cart");

  // сохраним последний заказ для страницы успеха
  localStorage.setItem("market_last_order_id", order.id);

  window.location.href = "order-success.html";
});