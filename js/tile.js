// tile.js — products list for a single tile by slug
(function () {
  const U = window.MarketUtils || (function(){
    // Fallback: if utils.js was not loaded, provide minimal helpers so tile does not crash
    function getQueryParam(key){
      try{ return new URLSearchParams(location.search).get(key) || ""; }catch{ return ""; }
    }
    function escapeHtml(str){
      return String(str ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }
    function formatKZT(value){
      const s = String(Math.round(Number(value)||0));
      const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      return `${spaced} ₸`;
    }
    function addToCart(id, badgeEl){
      const key = "market_cart";
      let cart = {};
      try{ cart = JSON.parse(localStorage.getItem(key)||"{}"); }catch{ cart = {}; }
      cart[id] = (Number(cart[id])||0) + 1;
      localStorage.setItem(key, JSON.stringify(cart));
      if (badgeEl) {
        const cnt = Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0);
        badgeEl.textContent = String(cnt);
      }
    }
    function updateCartBadge(badgeEl){
      if (!badgeEl) return;
      try{
        const cart = JSON.parse(localStorage.getItem("market_cart")||"{}");
        const cnt = Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0);
        badgeEl.textContent = String(cnt);
      }catch{ badgeEl.textContent = "0"; }
    }
    return { getQueryParam, escapeHtml, formatKZT, addToCart, updateCartBadge };
  })();

  const els = {
    title: document.getElementById("tileTitle"),
    sub: document.getElementById("tileSub"),
    grid: document.getElementById("productsGrid"),
    meta: document.getElementById("resultMeta"),
    empty: document.getElementById("emptyState"),
    q: document.getElementById("searchInput"),
    clear: document.getElementById("clearBtn"),
    cartBadge: document.getElementById("cartBadge"),
  };

  function getSlug() {
    let s = (U.getQueryParam("slug") || "").trim();
    if (!s) s = (U.getQueryParam("tile") || "").trim();
    if (!s) s = (U.getQueryParam("category") || "").trim();
    return s.toLowerCase();
  }

  function cardTemplate(p) {
    const img = (p.image_url || "").trim();
    const imgHtml = img
      ? `<img src="${U.escapeHtml(img)}" alt="">`
      : `<div class="ph">Фото</div>`;

    return `
      <article class="card" data-id="${p.id}">
        <div class="card__img">
          ${imgHtml}
          <div class="card__tag">${U.escapeHtml(p.category)}</div>
        </div>
        <div class="card__body">
          <h3 class="card__title">${U.escapeHtml(p.title)}</h3>
          <p class="card__desc">${U.escapeHtml(p.description)}</p>
          <div class="card__row">
            <div>
              <div class="price">${U.formatKZT(p.price)}</div>
              <div class="mini">В наличии: ${Number(p.stock) || 0}</div>
            </div>
            <button class="btn btn--primary" type="button" data-add>В корзину</button>
          </div>
        </div>
      </article>
    `;
  }

  function render(list) {
    els.grid.innerHTML = list.map(cardTemplate).join("");

    els.grid.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".card")?.dataset?.id;
        if (!id) return;
        U.addToCart(id, els.cartBadge, { hideWhenZero: false });
      });
    });


    // Open product page on card click
    els.grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card?.dataset?.id;
        if (id) location.href = `product.html?id=${id}`;
      });
    });

    if (els.empty) els.empty.style.display = list.length ? "none" : "";
    if (els.meta) els.meta.textContent = list.length ? `Найдено: ${list.length}` : "";
  }

  async function loadTile(slug) {
    const res = await fetch(window.API + "/api/categories");
    const list = await res.json().catch(() => []);
    return list.find((x) => String(x.slug) === slug) || null;
  }

  async function loadProducts(slug) {
    const res = await fetch(`/api/tiles/${encodeURIComponent(slug)}/products`);
    if (!res.ok) throw new Error(`api_failed_${res.status}`);
    return await res.json();
  }

  let all = [];

  function applyFilter() {
    const q = (els.q?.value || "").trim().toLowerCase();
    const out = !q
      ? all
      : all.filter((p) => {
          const t = `${p.title || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();
          return t.includes(q);
        });

    render(out);
  }

  (async function start() {
    U.updateCartBadge(els.cartBadge, { hideWhenZero: false });

    const slug = getSlug();
    if (!slug) {
      els.title.textContent = "Плитка не найдена";
      els.sub.textContent = "Нет параметра slug в URL.";
      return;
    }

    // Инфо о плитке (не критично)
    try {
      const tile = await loadTile(slug);
      if (tile) {
        els.title.textContent = `${tile.title}`;
        const sec = tile.section || tile.group_name || "";
        els.sub.textContent = sec ? `Раздел: ${sec} • slug: ${slug}` : `slug: ${slug}`;
        document.title = `Market — ${tile.title}`;
      } else {
        els.title.textContent = "Плитка";
        els.sub.textContent = `slug: ${slug}`;
      }
    } catch {
      els.title.textContent = "Плитка";
      els.sub.textContent = `slug: ${slug}`;
    }

    // Товары (критично)
    try {
      all = await loadProducts(slug);
      applyFilter();
    } catch (e) {
      console.error("Tile loadProducts error:", e);
      els.sub.textContent = "Ошибка загрузки товаров для этой плитки";
      if (els.empty) els.empty.style.display = "";
      render([]);
      return;
    }

    els.q?.addEventListener("input", applyFilter);
    els.clear?.addEventListener("click", () => {
      els.q.value = "";
      applyFilter();
    });
  })();
})();