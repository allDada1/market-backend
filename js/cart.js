const el = {
  list: document.getElementById("cartList"),
  total: document.getElementById("cartTotal"),
  clear: document.getElementById("clearCartBtn"),
  toCheckout: document.getElementById("toCheckoutBtn"),
  note: document.getElementById("cartNote"),
};

function formatKZT(value){
  const s = String(Math.round(Number(value) || 0));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced} ₸`;
}
function setNote(t){ if (el.note) el.note.textContent = t || ""; }

function loadCart(){
  try{ return JSON.parse(localStorage.getItem("market_cart") || "{}"); }catch{ return {}; }
}
function saveCart(cart){ localStorage.setItem("market_cart", JSON.stringify(cart)); }

async function getProductsMap(){
  const r = await fetch(window.API + "/api/products");
  const list = await r.json();
  return new Map(list.map(p => [p.id, p]));
}

function rowTemplate(p, qty){
  const sum = (Number(p.price)||0) * qty;
  return `
    <div class="cartItem" data-id="${p.id}">
      <div>
        <div class="cartItem__t">${p.title}</div>
        <div class="cartItem__s">${p.category} • ${formatKZT(p.price)}</div>
      </div>
      <div class="cartItem__right">
        <div><b>${formatKZT(sum)}</b></div>
        <div class="qtyRow">
          <button class="qtyBtn" data-dec type="button">−</button>
          <div class="qtyVal">${qty}</div>
          <button class="qtyBtn" data-inc type="button">+</button>
        </div>
      </div>
    </div>
  `;
}

async function render(){
  const cart = loadCart();
  const entries = Object.entries(cart).filter(([_,q]) => Number(q) > 0);

  if (!entries.length){
    el.list.innerHTML = `<div class="muted">Корзина пустая</div>`;
    el.total.textContent = formatKZT(0);
    setNote("");
    return;
  }

  const map = await getProductsMap();

  let total = 0;
  const rows = [];

  for (const [pid, qtyRaw] of entries){
    const pidNum = Number(pid);
    const qty = Math.max(1, Number(qtyRaw)||1);
    const p = map.get(pidNum);
    if (!p) continue;
    total += (Number(p.price)||0) * qty;
    rows.push(rowTemplate(p, qty));
  }

  el.list.innerHTML = rows.join("");
  el.total.textContent = formatKZT(total);

  el.list.querySelectorAll(".cartItem").forEach(item => {
    const pid = item.dataset.id;

    item.querySelector("[data-inc]")?.addEventListener("click", () => {
      const c = loadCart();
      c[pid] = Number(c[pid]||0) + 1;
      saveCart(c);
      render();
    });

    item.querySelector("[data-dec]")?.addEventListener("click", () => {
      const c = loadCart();
      const next = Number(c[pid]||0) - 1;
      if (next <= 0) delete c[pid];
      else c[pid] = next;
      saveCart(c);
      render();
    });
  });
}

el.clear?.addEventListener("click", () => {
  localStorage.setItem("market_cart", "{}");
  render();
});

el.toCheckout?.addEventListener("click", () => {
  const s = (() => { try{ return JSON.parse(localStorage.getItem("market_session")||"null"); }catch{ return null; } })();
  if (!s) { location.href = "login.html"; return; }
  location.href = "checkout.html";
});

render();