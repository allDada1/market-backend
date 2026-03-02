const els = {
  search: document.getElementById("searchInput"),
  clear: document.getElementById("clearBtn"),
  sort: document.getElementById("sortSelect"),

  grid: document.getElementById("productsGrid"),
  meta: document.getElementById("resultMeta"),
  empty: document.getElementById("emptyState"),

  cartBtn: document.getElementById("cartBtn"),
  cartBadge: document.getElementById("cartBadge"),
  profileBtn: document.getElementById("profileBtn"),
  goCatalogBtn: document.getElementById("goCatalogBtn"),
};

let state = { q:"", sort:"new_desc" };
let baseList = [];

function token(){ return MarketAPI.getToken(); }

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

function loadCart(){ try { return JSON.parse(localStorage.getItem("market_cart") || "{}"); } catch { return {}; } }
function saveCart(cart){ localStorage.setItem("market_cart", JSON.stringify(cart)); }
function cartCount(cart){ return Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0); }
function updateCartBadge(){
  const c = cartCount(loadCart());
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

function parseSort(v){
  const [s, d] = String(v||"new_desc").split("_");
  return { sort: s || "new", dir: (d === "asc" ? "asc" : "desc") };
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

function applyFilterSort(){
  const q = state.q.trim().toLowerCase();

  let list = baseList.slice();

  if (q){
    list = list.filter(p =>
      String(p.title||"").toLowerCase().includes(q) ||
      String(p.description||"").toLowerCase().includes(q) ||
      String(p.category||"").toLowerCase().includes(q)
    );
  }

  const { sort, dir } = parseSort(state.sort);
  if (sort === "price"){
    list.sort((a,b) => (Number(a.price||0) - Number(b.price||0)) * (dir === "asc" ? 1 : -1));
  } else if (sort === "likes"){
    list.sort((a,b) => Number(b.likes||0) - Number(a.likes||0));
  } else if (sort === "rating"){
    list.sort((a,b) => Number(b.rating_avg||0) - Number(a.rating_avg||0));
  } else {
    // new_desc: по id (новые выше)
    list.sort((a,b) => Number(b.id||0) - Number(a.id||0));
  }

  return list;
}

function render(){
  const list = applyFilterSort();
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
      if (e.target.closest("[data-add]")) return;
      location.href = `product.html?id=${card.dataset.id}`;
    });
  });

  els.grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(btn.closest(".card").dataset.id);
    });
  });
}

async function loadFavorites(){
  if (!token()){
    location.href = "login.html";
    return;
  }
  const res = await MarketAPI.apifetch(`${window.API}/api/favorites");
  if (!res.ok){
    location.href = "login.html";
    return;
  }
  baseList = await res.json();
  render();
}

// events
els.search.addEventListener("input", () => { state.q = els.search.value; render(); });
els.clear.addEventListener("click", () => { els.search.value=""; state.q=""; render(); });
els.sort.addEventListener("change", () => { state.sort = els.sort.value; render(); });

els.cartBtn.addEventListener("click", () => { location.href = token() ? "cart.html" : "login.html"; });
els.profileBtn.addEventListener("click", () => { location.href = token() ? "profile.html" : "login.html"; });
els.goCatalogBtn?.addEventListener("click", () => location.href="index.html");

window.addEventListener("storage",(e)=>{ if(e.key==="market_cart") updateCartBadge(); });

// start
updateCartBadge();
loadFavorites();
