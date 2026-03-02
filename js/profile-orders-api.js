(function () {
  function formatKZT(value){
    const s = String(Math.round(Number(value) || 0));
    const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${spaced} ₸`;
  }
  function formatDate(iso){
    try{ return new Date(iso).toLocaleString("ru-RU"); }catch{ return String(iso||"—"); }
  }

  const ordersList = document.getElementById("ordersList");
  const ordersEmpty = document.getElementById("ordersEmpty");
  const refreshBtn = document.getElementById("refreshOrdersBtn");

  if (!ordersList) return;

  async function loadMyOrders(){
    const res = await MarketAPI.apifetch(window.API + "/api/orders/my");
    if (res.status === 401) return { error:"unauthorized", orders:[] };
    if (!res.ok) return { error:"server_error", orders:[] };
    const data = await res.json().catch(()=>[]);
    return { error:null, orders:Array.isArray(data)?data:[] };
  }

  async function loadOrderDetails(id){
    const res = await MarketAPI.apiFetch(`/api/orders/${id}`);
    if (res.status === 401) return { error:"unauthorized" };
    if (!res.ok) return { error:"server_error" };
    const data = await res.json().catch(()=>null);
    return data ? { error:null, data } : { error:"bad_json" };
  }

  async function loadOrderHistory(id){
    const res = await MarketAPI.apiFetch(`/api/orders/${id}/history`);
    if (res.status === 401) return { error:"unauthorized", history:[] };
    if (!res.ok) return { error:"server_error", history:[] };
    const data = await res.json().catch(()=>[]);
    return { error:null, history:Array.isArray(data)?data:[] };
  }

  function timelineTemplate(history){
    if (!history || !history.length){
      return `<div class="muted" style="margin-top:8px;">История статусов пока пуста.</div>`;
    }
    return `
      <div class="timeline">
        <div class="detailBox__t">История статусов</div>
        <div class="timeline__list">
          ${history.map(h => `
            <div class="timeline__item">
              <div class="timeline__dot"></div>
              <div class="timeline__body">
                <div class="timeline__top">
                  <b>${h.status}</b>
                  <span class="timeline__time">${formatDate(h.created_at)}</span>
                </div>
                ${h.note ? `<div class="timeline__note">${h.note}</div>` : ``}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  async function repeatOrder(orderId){
    const res = await MarketAPI.apiFetch(`/api/orders/${orderId}/repeat`, { method:"POST" });
    if (res.status === 401){
      MarketAPI.setToken("");
      localStorage.removeItem("market_session");
      location.href = "login.html";
      return;
    }
    const data = await res.json().catch(()=>null);
    if (!res.ok || !data){
      alert("Не удалось повторить заказ.");
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const cart = (window.MarketUtils ? MarketUtils.loadCart() : (()=>{ try{return JSON.parse(localStorage.getItem("market_cart")||"{}")}catch{return{}} })());

    let removed = 0;
    let reduced = 0;

    for (const it of items){
      const pid = String(it.product_id);
      const want = Math.max(1, Number(it.qty)||1);
      const avail = Number(it.available_stock);
      if (Number.isFinite(avail)) {
        if (avail <= 0) { removed++; continue; }
        const q = Math.min(want, avail);
        if (q < want) reduced++;
        cart[pid] = q;
      } else {
        cart[pid] = want;
      }
    }

    if (window.MarketUtils) {
      MarketUtils.saveCart(cart);
      MarketUtils.updateCartBadge("cartBadge", { hideWhenZero: false });
    } else {
      localStorage.setItem("market_cart", JSON.stringify(cart));
    }

    if (removed || reduced){
      alert(`Корзина обновлена. Убрано товаров: ${removed}, уменьшено по наличию: ${reduced}.`);
    }

    location.href = "cart.html";
  }


  function orderCard(o){
    const status = o.status || "created";
    return `
      <article class="order" id="order-${o.id}" data-id="${o.id}">
        <div class="order__top" data-toggle>
          <div>
            <div class="order__id">#${o.id}</div>
            <div class="order__meta">${formatDate(o.created_at)} • статус: ${status}</div>
          </div>
          <div class="order__right">
            <div class="order__sum">${formatKZT(o.total)}</div>
            <div class="pill pill--created">${status}</div>
          </div>
        </div>
        <div class="order__details"></div>
      </article>
    `;
  }

  function detailsTemplate(order, items, history){
    const itemsHtml = (items || []).map(it => `
      <div class="itemRow">
        <span>${it.title} <b>×${it.qty}</b></span>
        <span>${formatKZT(it.price * it.qty)}</span>
      </div>
    `).join("");

    return `
      <div class="detailGrid">
        <div class="detailBox">
          <div class="detailBox__t">Доставка</div>
          <div class="detailBox__v">
            Город: <b>${order.delivery_city || "—"}</b><br>
            Адрес: <b>${order.delivery_address || "—"}</b><br>
            Телефон: <b>${order.phone || "—"}</b>
          </div>
        </div>
        <div class="detailBox">
          <div class="detailBox__t">Суммы</div>
          <div class="detailBox__v">
            Товары: <b>${formatKZT(order.subtotal)}</b><br>
            Доставка: <b>${formatKZT(order.delivery_price)}</b><br>
            Итого: <b>${formatKZT(order.total)}</b>
          </div>
        </div>
      </div>
      <div class="items">
        <div class="itemsHead">
          <div class="detailBox__t">Состав заказа</div>
          <button class="btn btn--ghost btnRepeat" type="button" data-repeat>Повторить</button>
        </div>
        ${itemsHtml || `<div style="color:rgba(255,255,255,.7)">Пусто</div>`}
      </div>
      ${timelineTemplate(history)}
    `;
  }

  async function render(){
    const { error, orders } = await loadMyOrders();

    if (error === "unauthorized"){
      MarketAPI.setToken("");
      localStorage.removeItem("market_session");
      location.href = "login.html";
      return;
    }

    if (!orders.length){
      ordersList.innerHTML = "";
      if (ordersEmpty) ordersEmpty.hidden = false;
      return;
    }
    if (ordersEmpty) ordersEmpty.hidden = true;

    ordersList.innerHTML = orders.map(orderCard).join("");

    ordersList.querySelectorAll("[data-toggle]").forEach(top => {
      top.addEventListener("click", async () => {
        const root = top.closest(".order");
        const details = root.querySelector(".order__details");

        root.classList.toggle("is-open");
        if (!root.classList.contains("is-open")) return;

        if (details.dataset.loaded === "1") return;

        details.innerHTML = `<div class="muted" style="padding:10px 0;">Загрузка…</div>`;
        const id = root.dataset.id;

        const [d, h] = await Promise.all([loadOrderDetails(id), loadOrderHistory(id)]);
        if (d.error === "unauthorized"){
          MarketAPI.setToken("");
          localStorage.removeItem("market_session");
          location.href = "login.html";
          return;
        }
        if (d.error){
          details.innerHTML = `<div class="muted" style="padding:10px 0;">Ошибка деталей</div>`;
          return;
        }

        details.innerHTML = detailsTemplate(d.data.order, d.data.items, (h && !h.error) ? h.history : []);
        details.dataset.loaded = "1";

        const btnRepeat = details.querySelector('[data-repeat]');
        btnRepeat?.addEventListener('click', (e)=>{ e.stopPropagation(); repeatOrder(id); });
      });
    });
  }

  refreshBtn?.addEventListener("click", render);
  render();
})();