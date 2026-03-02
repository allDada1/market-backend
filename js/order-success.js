function formatKZT(value){
  const s = String(Math.round(value));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced} ₸`;
}

function loadOrders(){
  try{ return JSON.parse(localStorage.getItem("market_orders") || "[]"); }
  catch{ return []; }
}

const orderIdEl = document.getElementById("orderId");
const totalEl = document.getElementById("orderTotal");
const tinyEl = document.getElementById("tiny");

const lastId = localStorage.getItem("market_last_order_id");
const orders = loadOrders();
const order = lastId ? orders.find(o => o.id === lastId) : null;

if (!order){
  orderIdEl.textContent = "—";
  totalEl.textContent = "—";
  tinyEl.textContent = "Не нашли последний заказ. Возможно, localStorage очищен.";
} else {
  orderIdEl.textContent = order.id;
  totalEl.textContent = formatKZT(order.total);

  const dt = new Date(order.createdAt);
  tinyEl.textContent = `Создан: ${dt.toLocaleString("ru-RU")}. Заказы хранятся локально (market_orders).`;
}
