(function(){
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

  function starsSmall(avg){
    const a = Number(avg)||0;
    return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
  }

  const els = {
    name: document.getElementById("sellerName"),
    meta: document.getElementById("sellerMeta"),
    stats: document.getElementById("sellerStats"),
    avatar: document.getElementById("sellerAvatar"),
    grid: document.getElementById("productsGrid"),
    empty: document.getElementById("emptyState"),
    search: document.getElementById("searchInput"),
    clear: document.getElementById("clearBtn"),
    resultMeta: document.getElementById("resultMeta"),
    cartBadge: document.getElementById("cartBadge"),
    profileLink: document.getElementById("profileLink"), // если есть в шапке
    followBtn: document.getElementById("followBtn"),

    // кнопки шапки (как на главной)
    cartBtn: document.getElementById("cartBtn"),
    profileBtn: document.getElementById("profileBtn"),
    loginBtn: document.getElementById("loginBtn"),
    registerBtn: document.getElementById("registerBtn"),
  };

  // ===== tokens =====
  function getTokenAny(){
    try{
      const t = (window.MarketAPI && typeof MarketAPI.getToken === "function")
        ? (MarketAPI.getToken() || "")
        : "";
      return t ||
        localStorage.getItem("market_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("accessToken") ||
        "";
    } catch {
      return localStorage.getItem("market_token") ||
             localStorage.getItem("token") ||
             localStorage.getItem("authToken") ||
             localStorage.getItem("accessToken") ||
             "";
    }
  }

  // ===== header behavior (like main) =====
  function initHeader(){
    const token = getTokenAny();

    // если есть "Профиль" как ссылка
    if (els.profileLink){
      els.profileLink.href = token ? "profile.html" : "login.html";
      els.profileLink.addEventListener("click", (e)=>{
        e.preventDefault();
        location.href = token ? "profile.html" : "login.html";
      });
    }

    // если есть кнопки как на главной
    if (els.cartBtn){
      els.cartBtn.addEventListener("click", ()=>{
        location.href = token ? "cart.html" : "login.html";
      });
    }

    if (els.profileBtn){
      els.profileBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        // можно открыть dropdown, но главное — переход
        location.href = token ? "profile.html" : "login.html";
      });
    }

    // скрытие/показ кнопок входа
    if (token){
      if (els.loginBtn) els.loginBtn.style.display = "none";
      if (els.registerBtn) els.registerBtn.style.display = "none";
    } else {
      if (els.loginBtn) els.loginBtn.style.display = "";
      if (els.registerBtn) els.registerBtn.style.display = "";
    }
  }

  // ===== cart badge (same key as cart.js) =====
  function cartCount(){
    try{
      const cart = JSON.parse(localStorage.getItem("market_cart")||"{}");
      return Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0);
    } catch { return 0; }
  }

  function updateCartBadge(){
    if (!els.cartBadge) return;
    els.cartBadge.textContent = String(cartCount());
  }

  function getSellerId(){
    const sp = new URLSearchParams(location.search);
    const id = Number(sp.get("id") || 0);
    return Number.isFinite(id) ? id : 0;
  }

  function apiFetch(url, options){
    if (window.MarketAPI && typeof MarketAPI.apiFetch === "function"){
      return MarketAPI.apiFetch(url, options);
    }

    // fallback
    const opt = { ...(options||{}) };
    opt.headers = opt.headers ? { ...opt.headers } : {};
    const t = getTokenAny();
    if (t && !opt.headers.Authorization) opt.headers.Authorization = "Bearer " + t;
    return fetch(url, opt);
  }

  async function getMyUser(){
    const t = getTokenAny();
    if (!t) return null;

    const r = await fetch(window.API + "/api/auth/me", {
      headers: { Authorization: "Bearer " + t }
    });

    if (!r.ok) return null;

    const data = await r.json().catch(()=>({}));
    return data.user || null;
  }

  async function setupFollow(sellerId){
    if (!els.followBtn) return;

    const me = await getMyUser();
    if (!me){
      els.followBtn.hidden = false;
      els.followBtn.textContent = "Войти, чтобы подписаться";
      els.followBtn.onclick = ()=>{ location.href = "login.html"; };
      return;
    }

    if (Number(me.id) === Number(sellerId)){
      els.followBtn.hidden = true;
      return;
    }

    els.followBtn.hidden = false;

    async function refresh(){
      const r = await apiFetch(`/api/sellers/${sellerId}/following`);
      const data = r.ok ? await r.json().catch(()=>({})) : {};
      const following = !!data.following;
      els.followBtn.dataset.following = following ? "1" : "0";
      els.followBtn.textContent = following ? "Отписаться" : "Подписаться";
    }

    els.followBtn.onclick = async ()=>{
      els.followBtn.disabled = true;
      try{
        const isFollowing = els.followBtn.dataset.following === "1";
        const method = isFollowing ? "DELETE" : "POST";
        const r = await apiFetch(`/api/sellers/${sellerId}/follow`, { method });
        if (!r.ok){
          const e = await r.json().catch(()=>({}));
          alert("Ошибка: " + (e.error || r.status));
          return;
        }
        await refresh();
      } finally {
        els.followBtn.disabled = false;
      }
    };

    await refresh();
  }

  function cardTemplate(p){
    const img = (p.image_url || "").trim();
    const imgHtml = img
      ? `<img src="${escapeHtml(img)}" alt="">`
      : `<div class="ph">Фото</div>`;

    return `
      <article class="card" data-id="${p.id}">
        <div class="card__img">
          ${imgHtml}
          <div class="card__tag">${escapeHtml(p.category)}</div>
          <div class="card__stat">
            <div class="pillStat">♥ ${Number(p.likes||0)}</div>
            <div class="pillStat">${starsSmall(p.rating_avg)}</div>
          </div>
        </div>

        <div class="card__body">
          <h3 class="card__title">${escapeHtml(p.title)}</h3>
          <p class="card__desc">${escapeHtml(p.description)}</p>
          <div class="card__row">
            <div>
              <div class="price">${formatKZT(p.price)}</div>
              <div class="mini">В наличии: ${Number(p.stock)||0}</div>
            </div>
            <button class="btn btn--primary" type="button" data-open>Открыть</button>
          </div>
        </div>
      </article>
    `;
  }

  function bind(){
    if (!els.grid) return;

    els.grid.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.stopPropagation();
        const id = btn.closest(".card")?.dataset?.id;
        if (id) location.href = `product.html?id=${id}`;
      });
    });

    els.grid.querySelectorAll(".card").forEach(card=>{
      card.addEventListener("click", ()=>{
        location.href = `product.html?id=${card.dataset.id}`;
      });
    });
  }

  let all = [];
  function applyFilter(){
    const q = (els.search?.value || "").trim().toLowerCase();
    const list = !q ? all : all.filter(p=>{
      const t = `${p.title||""} ${p.description||""} ${p.category||""}`.toLowerCase();
      return t.includes(q);
    });

    if (els.grid) els.grid.innerHTML = list.map(cardTemplate).join("");
    bind();

    if (els.empty) els.empty.hidden = list.length > 0;
    if (els.resultMeta) els.resultMeta.textContent = list.length ? `Товаров: ${list.length}` : "";
  }

  async function load(){
    const id = getSellerId();
    if (!id){
      if (els.name) els.name.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Некорректный id продавца.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    const profRes = await fetch(`/api/sellers/${id}`);
    if (!profRes.ok){
      if (els.name) els.name.textContent = "Магазин не найден";
      if (els.meta) els.meta.textContent = "Продавец не существует или удалён.";
      if (els.empty) els.empty.hidden = false;
      return;
    }

    const prof = await profRes.json();
    const seller = prof.seller;
    const displayName = seller.nickname ? seller.nickname : seller.name;

    document.title = `DarkMarket — Магазин: ${displayName}`;
    if (els.name) els.name.textContent = displayName;
    if (els.meta) els.meta.textContent = seller.nickname ? `${seller.name}` : "Продавец";
    if (els.stats) els.stats.textContent = `Объявлений: ${prof.stats.products_count} • Лайков: ${prof.stats.likes_count}`;

    if (els.avatar){
      if (seller.avatar_url){
        els.avatar.innerHTML = `<img src="${escapeHtml(seller.avatar_url)}" alt="">`;
      } else {
        els.avatar.textContent = (displayName || "S").slice(0,1).toUpperCase();
      }
    }

    const prodRes = await fetch(`/api/sellers/${id}/products`);
    all = prodRes.ok ? await prodRes.json() : [];
    applyFilter();

    setupFollow(id).catch(console.error);
  }

  // init
  initHeader();
  updateCartBadge();

  window.addEventListener("storage", (e)=>{
    if (e.key === "market_cart") updateCartBadge();
  });

  els.clear?.addEventListener("click", ()=>{
    if (els.search) els.search.value = "";
    applyFilter();
  });

  els.search?.addEventListener("input", applyFilter);

  load().catch(err=>{
    console.error(err);
    if (els.name) els.name.textContent = "Ошибка";
    if (els.meta) els.meta.textContent = "Не удалось загрузить магазин.";
    if (els.empty) els.empty.hidden = false;
  });
})();