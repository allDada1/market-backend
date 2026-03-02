// category.js — страница категории: chips + поиск + карточки

const els = {
  catTitle: document.getElementById("catTitle"),
  catSub: document.getElementById("catSub"),
  search: document.getElementById("searchInput"),
  clear: document.getElementById("clearBtn"),
  grid: document.getElementById("productsGrid"),
  meta: document.getElementById("resultMeta"),
  empty: document.getElementById("emptyState"),
  reset: document.getElementById("resetBtn"),
  chips: document.getElementById("categoryChips"),

  cartBtn: document.getElementById("cartBtn"),
  cartBadge: document.getElementById("cartBadge"),
  profileBtn: document.getElementById("profileBtn"),
};

let state = { q:"", cat:"Все" };
let allCategories = ["Все"];

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
  await loadLikedIds();
}

function getCatFromUrl(){
  const sp = new URLSearchParams(location.search);
  const cat = sp.get("cat");
  return cat ? String(cat) : "Все";
}

async function apiGetAllProducts(){
  const res = await fetch(`${window.API}/api/products");
  if (!res.ok) throw new Error("api_failed");
  return await res.json();
}
async function apiGetProducts(){
  const sp = new URLSearchParams();
  if (state.q.trim()) sp.set("q", state.q.trim());
  if (state.cat !== "Все") sp.set("cat", state.cat);
  const url = "/api/products" + (sp.toString() ? `?${sp.toString()}` : "");
  const res = await MarketAPI.apiFetch(url);
  if (!res.ok) throw new Error("api_failed");
  return await res.json();
}

function starsSmall(avg){
  const a = Number(avg) || 0;
  return a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
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

async function loadCategories(){
  const list = await apiGetAllProducts();
  const cats = Array.from(new Set(list.map(x => x.category).filter(Boolean)));
  allCategories = ["Все", ...cats];
  renderChips();
}

function renderChips(){
  els.chips.innerHTML = "";
  allCategories.forEach(cat => {
    const b = document.createElement("button");
    b.type="button";
    b.className="chip" + (cat===state.cat ? " is-active" : "");
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.cat = cat;
      renderChips();
      els.catTitle.textContent = cat === "Все" ? "Каталог" : cat;
      els.catSub.textContent = cat === "Все" ? "Все категории" : "Страница категории";
      renderProducts();
    });
    els.chips.appendChild(b);
  });
}

async function renderProducts(){
  try{
    const list = await apiGetProducts();
    els.meta.textContent = `Товаров: ${list.length}`;

    if (!list.length){
      els.grid.innerHTML = "";
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;

    els.grid.innerHTML = list.map(cardTemplate).join("");

    els.grid.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]") || e.target.closest("[data-fav]")) return;
        location.href = `product.html?id=${card.dataset.id}`;
      });
    });
    els.grid.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(btn.closest(".card").dataset.id);
      });
    });
  }catch(err){
    console.error(err);
    els.meta.textContent = "Ошибка загрузки";
  }
}

els.search?.addEventListener("input", () => { state.q = els.search.value; renderProducts(); });
els.clear?.addEventListener("click", () => { els.search.value=""; state.q=""; renderProducts(); });
els.reset?.addEventListener("click", () => { state.q=""; state.cat="Все"; els.search.value=""; renderChips(); renderProducts(); });

els.cartBtn?.addEventListener("click", () => { location.href = token() ? "cart.html" : "login.html"; });
els.profileBtn?.addEventListener("click", () => { location.href = token() ? "profile.html" : "login.html"; });

updateCartBadge();
  await loadLikedIds();
state.cat = getCatFromUrl();
els.catTitle.textContent = state.cat === "Все" ? "Каталог" : state.cat;
els.catSub.textContent = state.cat === "Все" ? "Все категории" : "Страница категории";
loadCategories().then(renderProducts);
