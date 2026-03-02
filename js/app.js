const els = {
  search: document.getElementById("searchInput") || document.querySelector("[data-search]"),
  clear: document.getElementById("clearBtn") || document.querySelector("[data-search-clear]"),
  grid: document.getElementById("productsGrid"),
  meta: document.getElementById("resultMeta"),
  empty: document.getElementById("emptyState"),
  reset: document.getElementById("resetBtn"),
  chips: document.getElementById("categoryChips"),

  // сортировка (теперь скрываем и показываем только когда есть поиск)
  sortRow: document.getElementById("sortRow"),
  sort: document.getElementById("sortSelect"),

  cartBtn: document.getElementById("cartBtn"),
  cartBadge: document.getElementById("cartBadge"),
  profileBtn: document.getElementById("profileBtn"),
  goAdmin: document.getElementById("goAdmin"),
  goAdminCats: document.getElementById("goAdminCats"),
  goProfile: document.getElementById("goProfile"),
  goLogin: document.getElementById("goLogin"),
  goReg: document.getElementById("goReg"),

  // популярное
  popularWrap: document.getElementById("popularWrap"),
  popularLiked: document.getElementById("popularLiked"),
  popularRated: document.getElementById("popularRated"),
};

let state = { q: "", cat: "Все", sort: "new_desc" };
let allCategories = ["Все"];
let me = null;

// -------- utils --------
function formatKZT(value){
  const s = String(Math.round(Number(value) || 0));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${spaced} ₸`;
}
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function token(){ return MarketAPI.getToken(); }

// favorites/likes as "Избранное"
let likedIds = new Set();

async function loadLikedIds(){
  likedIds = new Set();
  if (!token()) return;
  try{
    const res = await MarketAPI.apifetch(`${window.API}/api/favorites");
    if (!res.ok) return;
    const list = await res.json().catch(()=>[]);
    likedIds = new Set((list||[]).map(p => Number(p.id)).filter(n => Number.isFinite(n)));
  }catch{}
}

async function toggleFavorite(productId, btn){
  if (!token()){
    location.href = "login.html";
    return;
  }
  const id = Number(productId);
  if (!Number.isFinite(id)) return;
  try{
    const res = await MarketAPI.apiFetch(`/api/products/${id}/like`, { method:"POST" });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return;
    const liked = !!data.liked;
    if (liked) likedIds.add(id); else likedIds.delete(id);
    if (btn) btn.classList.toggle("is-active", liked);
    const card = btn?.closest?.(".card");
    const pill = card?.querySelector?.(".card__stat .pillStat");
    if (pill && typeof data.likes !== "undefined") pill.textContent = `♥ ${Number(data.likes)||0}`;
  }catch(err){
    console.error(err);
  }
}

function parseSort(v){
  const [s, d] = String(v||"new_desc").split("_");
  return { sort: s || "new", dir: (d === "asc" ? "asc" : "desc") };
}

// -------- cart --------
function loadCart(){ try { return JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { return {}; } }
function saveCart(cart){ localStorage.setItem("market_cart", JSON.stringify(cart)); }
function cartCount(cart){ return Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0); }
function updateCartBadge(){
  const c = cartCount(loadCart());
  if (!els.cartBadge) return;
  els.cartBadge.hidden = c <= 0;
  els.cartBadge.textContent = String(c);
}
function addToCart(id){
  const cart = loadCart();
  const k = String(id);
  cart[k] = (Number(cart[k])||0) + 1;
  saveCart(cart);
  updateCartBadge();
}

// -------- auth/menu --------
async function loadMe(){
  if (!token()) { me = null; updateTopUserUI(); return; }
  const res = await MarketAPI.apifetch(`${window.API}/api/auth/me");
  if (!res.ok){ me = null; updateTopUserUI(); return; }
  const data = await res.json().catch(()=>({}));
  me = data.user || null;
  updateTopUserUI();
}
function updateTopUserUI(){
  const span = els.profileBtn?.querySelector("span:last-child");
  if (span) span.textContent = me ? "Профиль" : "Войти";

  if (els.goAdmin) els.goAdmin.style.display = (me && me.is_admin) ? "" : "none";
  if (els.goAdminCats) els.goAdminCats.style.display = (me && me.is_admin) ? "" : "none";
  if (els.goProfile) els.goProfile.style.display = me ? "" : "none";
  if (els.goLogin) els.goLogin.style.display = me ? "none" : "";
  if (els.goReg) els.goReg.style.display = me ? "none" : "";
}

// -------- categories chips (groups) --------
async function loadCategories(){
  const res = await fetch(`${window.API}/api/category-groups");
  if (!res.ok) {
    // fallback: старый способ из товаров
    const list = await fetch(`${window.API}/api/products").then(r=>r.json()).catch(()=>[]);
    const cats = Array.from(new Set(list.map(x=>x.category).filter(Boolean)));
    allCategories = ["Все", ...cats];
    renderChips();
    return;
  }
  const rows = await res.json();
  const groups = rows.map(r => r.group_name).filter(Boolean);
  allCategories = ["Все", ...groups];
  renderChips();
}
function renderChips(){
  if (!els.chips) return;
  els.chips.innerHTML = "";
  allCategories.forEach(cat => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (cat === state.cat ? " is-active" : "");
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.cat = cat;
      renderChips();
      renderProducts();
      // популярное показываем только когда "Все" и нет поиска
      updatePopularVisibility();
    });
    els.chips.appendChild(b);
  });
}

async function apiGetProducts(){
  // всегда грузим список (с лайками/рейтингом)
  const res = await MarketAPI.apifetch(`${window.API}/api/products");
  if (!res.ok) throw new Error("api_products_failed");
  let list = await res.json();

  // фильтр по категории
  if (state.cat !== "Все"){
    list = list.filter(p => String(p.category||"") === state.cat);
  }

  // поиск (по title/description/category)
  const q = state.q.trim().toLowerCase();
  if (q){
    list = list.filter(p => {
      const t = String(p.title||"").toLowerCase();
      const d = String(p.description||"").toLowerCase();
      const c = String(p.category||"").toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }

  // сортировка только при поиске
  if (q){
    const { sort, dir } = parseSort(state.sort);

    if (sort === "price"){
      list.sort((a,b)=>(Number(a.price||0)-Number(b.price||0)) * (dir==="asc"?1:-1));
    } else if (sort === "likes"){
      list.sort((a,b)=>Number(b.likes||0)-Number(a.likes||0));
    } else if (sort === "rating"){
      list.sort((a,b)=>Number(b.rating_avg||0)-Number(a.rating_avg||0));
    } else {
      // new
      list.sort((a,b)=>Number(b.id||0)-Number(a.id||0));
    }
  } else {
    // без поиска — новые первыми
    list.sort((a,b)=>Number(b.id||0)-Number(a.id||0));
  }

  return list;
}

async function apiGetAllProducts(){
  const res = await MarketAPI.apifetch(`${window.API}/api/products");
  if (!res.ok) return [];
  return await res.json();
}

// -------- cards --------
function starsSmall(avg){
  const a = Number(avg) || 0;
  return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
}

function sellerLine(p){
  const sid = Number(p.seller_id || p.owner_user_id || 0);
  if (!Number.isFinite(sid) || sid <= 0) return "";
  const name = String(p.seller_nickname || p.seller_name || "").trim();
  const label = name || `Продавец #${sid}`;
  return `<div class="mini">Продавец: <a href="seller.html?id=${sid}" class="miniLink" onclick="event.stopPropagation()">${escapeHtml(label)}</a></div>`;
}

function cardTemplate(p){
  const img = (p.image_url || "").trim();
  const imgHtml = img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="ph">Фото</div>`;

  return `
    <article class="card" data-id="${p.id}">
      <div class="card__img">
        ${imgHtml}
        <div class="card__tag">${escapeHtml(p.category)}</div>
        <button class="card__fav${likedIds.has(Number(p.id)) ? " is-active" : ""}" type="button" data-fav aria-label="В избранное">♥</button>
        <div class="card__stat">
          <div class="pillStat">♥ ${Number(p.likes||0)}</div>
          <div class="pillStat">${starsSmall(p.rating_avg)}</div>
        </div>
      </div>

      <div class="card__body">
        <h3 class="card__title">${escapeHtml(p.title)}</h3>
        <p class="card__desc">${escapeHtml(p.description)}</p>

        ${sellerLine(p)}

        <div class="card__row">
          <div>
            <div class="price">${formatKZT(p.price)}</div>
            <div class="mini">В наличии: ${Number(p.stock)||0}</div>
          </div>
          <button class="btn btn--primary" type="button" data-add>В корзину</button>
        </div>
      </div>
    </article>
  `;
}

function bindCardClicks(container){
  if (!container) return;
  container.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-add]") || e.target.closest("[data-fav]")) return;
      location.href = `product.html?id=${card.dataset.id}`;
    });
  });
  container.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.closest(".card").dataset.id;
      addToCart(id);
    });


  container.querySelectorAll("[data-fav]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.closest(".card")?.dataset?.id;
      if (!id) return;
      toggleFavorite(id, btn);
    });
  });
  });
}

// -------- render main products --------
async function renderProducts(){
  try{
    const list = await apiGetProducts();
    if (els.meta) els.meta.textContent = `Товаров: ${list.length}`;

    if (!list.length){
      if (els.grid) els.grid.innerHTML = "";
      if (els.empty) els.empty.hidden = false;
      return;
    }
    if (els.empty) els.empty.hidden = true;

    els.grid.innerHTML = list.map(cardTemplate).join("");
    bindCardClicks(els.grid);

  }catch(err){
    console.error(err);
    if (els.meta) els.meta.textContent = "Ошибка загрузки";
  }
}

// -------- popular --------
function updatePopularVisibility(){
  const show = (state.q.trim().length === 0) && (state.cat === "Все");
  if (els.popularWrap) els.popularWrap.hidden = !show;
}

async function renderPopular(){
  if (!els.popularWrap || !els.popularLiked || !els.popularRated) return;

  const list = await apiGetAllProducts();

  // показываем только когда не ищут и "Все"
  updatePopularVisibility();

  // топ по лайкам
  const topLikes = list.slice().sort((a,b)=>Number(b.likes||0)-Number(a.likes||0)).slice(0, 10);
  // топ по рейтингу (сначала где есть rating_count > 0, потом avg)
  const topRated = list.slice().sort((a,b)=>{
    const ac = Number(a.rating_count||0), bc = Number(b.rating_count||0);
    if (bc !== ac) return bc - ac;
    return Number(b.rating_avg||0) - Number(a.rating_avg||0);
  }).slice(0, 10);

  els.popularLiked.innerHTML = topLikes.map(cardTemplate).join("");
  els.popularRated.innerHTML = topRated.map(cardTemplate).join("");

  bindCardClicks(els.popularLiked);
  bindCardClicks(els.popularRated);
}

// -------- sort visibility (only on search) --------
function updateSortUI(){
  const searching = state.q.trim().length > 0;
  if (els.sortRow) els.sortRow.hidden = !searching;
}

// -------- events --------
function wireSearch(){
  if (!els.search) return;

  els.search.addEventListener("input", () => {
    state.q = els.search.value;
    updateSortUI();
    updatePopularVisibility();
    renderProducts();
  });

  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){
      state.q = els.search.value;
      updateSortUI();
      updatePopularVisibility();
      renderProducts();
    }
  });
}

els.clear?.addEventListener("click", () => {
  if (els.search) els.search.value = "";
  state.q = "";
  updateSortUI();
  updatePopularVisibility();
  renderProducts();
});

els.reset?.addEventListener("click", () => {
  state.q = "";
  state.cat = "Все";
  state.sort = "new_desc";
  if (els.search) els.search.value = "";
  if (els.sort) els.sort.value = "new_desc";
  renderChips();
  updateSortUI();
  updatePopularVisibility();
  renderProducts();
});

els.sort?.addEventListener("change", () => {
  state.sort = els.sort.value;
  renderProducts();
});

els.cartBtn?.addEventListener("click", () => { location.href = token() ? "cart.html" : "login.html"; });
els.profileBtn?.addEventListener("click", () => { location.href = token() ? "profile.html" : "login.html"; });

window.addEventListener("storage", (e) => { if (e.key === "market_cart") updateCartBadge(); });

// -------- start --------
updateCartBadge();
wireSearch();
updateSortUI();
updatePopularVisibility();

Promise.resolve()
  .then(loadMe)
  .then(loadCategories)
  .then(loadLikedIds)
  .then(() => { if (els.sort?.value) state.sort = els.sort.value; })
  .then(renderProducts)
  .then(renderPopular);

  // ===== SEARCH SUGGESTIONS =====
const suggestBox = document.getElementById("searchSuggest");

function highlight(text, q){
  const re = new RegExp(`(${q})`, "ig");
  return text.replace(re, `<span class="highlight">$1</span>`);
}

async function fetchSuggest(q){
  const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) return { products: [], categories: [] };
  return await res.json();
}

function renderSuggest(data, q){
  if (!data.products.length && !data.categories.length){
    suggestBox.hidden = true;
    return;
  }

  let html = "";

  if (data.products.length){
    html += `
      <div class="suggestGroup">
        <div class="suggestTitle">Товары</div>
        ${data.products.map(p => `
          <div class="suggestItem" data-product="${p.id}">
            <div>
              ${highlight(p.title, q)}
              <small>${p.category}</small>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  if (data.categories.length){
    html += `
      <div class="suggestGroup">
        <div class="suggestTitle">Категории</div>
        ${data.categories.map(c => `
          <div class="suggestItem" data-category="${c}">
            ${highlight(c, q)}
          </div>
        `).join("")}
      </div>
    `;
  }

  suggestBox.innerHTML = html;
  suggestBox.hidden = false;

  // клики
  suggestBox.querySelectorAll("[data-product]").forEach(el => {
    el.addEventListener("click", () => {
      location.href = `product.html?id=${el.dataset.product}`;
    });
  });

  suggestBox.querySelectorAll("[data-category]").forEach(el => {
    el.addEventListener("click", () => {
      location.href = `category.html?cat=${encodeURIComponent(el.dataset.category)}`;
    });
  });
}

if (els.search){
  els.search.addEventListener("input", async () => {
    const q = els.search.value.trim();
    if (q.length < 2){
      suggestBox.hidden = true;
      return;
    }

    const data = await fetchSuggest(q);
    renderSuggest(data, q);
  });

  document.addEventListener("click", (e)=>{
    if (!e.target.closest(".searchSuggest") && !e.target.closest("#searchInput")){
      suggestBox.hidden = true;
    }
  });
}