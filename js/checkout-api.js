const btn = document.getElementById("placeOrderBtn");
const cityEl = document.getElementById("city");
const addrEl = document.getElementById("address");
const phoneEl = document.getElementById("phone");
const msg = document.getElementById("checkoutMsg");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

function loadCart(){
  try{ return JSON.parse(localStorage.getItem("market_cart") || "{}"); }catch{ return {}; }
}
function clearCart(){ localStorage.setItem("market_cart", "{}"); }

btn?.addEventListener("click", async () => {
  setMsg("");

  if (!MarketAPI.getToken()){
    location.href = "login.html";
    return;
  }

  const cart = loadCart();
  const entries = Object.entries(cart).filter(([_,q]) => Number(q) > 0);
  if (!entries.length){
    setMsg("Корзина пустая.");
    return;
  }

  const items = entries.map(([pid, qty]) => ({
    product_id: Number(pid),
    qty: Number(qty)
  })).filter(x => Number.isFinite(x.product_id) && x.qty > 0);

  const delivery = {
    method: "standard",
    city: String(cityEl?.value || "").trim(),
    address: String(addrEl?.value || "").trim(),
    phone: String(phoneEl?.value || "").trim(),
    price: 0
  };

  const res = await MarketAPI.apiFetch(window.API + "/api/orders", {
    method: "POST",
    body: JSON.stringify({ items, delivery, comment: "" })
  });

  const data = await res.json().catch(()=>({}));

  
  if (!res.ok){
    // Friendly stock handling
    if (data && data.error === "not_enough_stock"){
      const pid = String(data.product_id || "");
      const title = data.title || ("Товар #" + pid);
      const reqQty = Number(data.requested_qty || 0);
      const avail = Number(data.available_stock);

      // update cart (best-effort)
      try {
        const cart2 = (window.MarketUtils ? MarketUtils.loadCart() : loadCart());
        if (Number.isFinite(avail)) {
          if (avail <= 0) {
            delete cart2[pid];
          } else {
            cart2[pid] = avail;
          }
          if (window.MarketUtils) MarketUtils.saveCart(cart2);
          else localStorage.setItem("market_cart", JSON.stringify(cart2));
        }
      } catch {}

      if (Number.isFinite(avail)) {
        if (avail <= 0) {
          setMsg(`Товар закончился: ${title}. Мы убрали его из корзины.`);
        } else {
          setMsg(`Недостаточно товара: ${title}. Хотели ${reqQty || "—"}, доступно ${avail}. Корзина обновлена.`);
        }
      } else {
        setMsg(`Недостаточно товара: ${title}. Корзина обновлена.`);
      }
      return;
    }

    setMsg("Ошибка оформления: " + (data.error || "unknown"));
    return;
  }
clearCart();
  location.href = `order-success.html?id=${data.id}`;
});