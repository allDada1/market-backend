const el = {
  imgBox: document.getElementById("imgBox"),
  tagCat: document.getElementById("tagCat"),
  crumbCat: document.getElementById("crumbCat"),
  crumbTitle: document.getElementById("crumbTitle"),

  title: document.getElementById("title"),
  desc: document.getElementById("desc"),
  sellerLink: document.getElementById("sellerLink"),
  price: document.getElementById("price"),
  addBtn: document.getElementById("addBtn"),
  buyBtn: document.getElementById("buyBtn"),
  note: document.getElementById("noteLine"),

  likeBtn: document.getElementById("likeBtn"),
  likeText: document.getElementById("likeText"),

  ratingAvg: document.getElementById("ratingAvg"),
  ratingMeta: document.getElementById("ratingMeta"),
  ratingStars: document.getElementById("ratingStars"),

  searchGo: document.getElementById("searchGo"),
};

function formatKZT(value){
  const s = String(Math.round(Number(value)||0));
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g," ");
  return `${spaced} ₸`;
}
function setNote(t){
  if (el.note) el.note.textContent = t || "";
}
function token(){ return MarketAPI.getToken(); }

function loadCart(){ try{ return JSON.parse(localStorage.getItem("market_cart")||"{}"); }catch{ return {}; } }
function saveCart(c){ localStorage.setItem("market_cart", JSON.stringify(c)); }
function addToCart(id){
  const cart = loadCart();
  const k = String(id);
  cart[k] = (Number(cart[k])||0) + 1;
  saveCart(cart);
}

function getId(){
  const sp = new URLSearchParams(location.search);
  return Number(sp.get("id"));
}

function renderStars(myRating){
  el.ratingStars.innerHTML = "";
  for (let i=1;i<=5;i++){
    const b = document.createElement("button");
    b.type="button";
    b.className = "starBtn" + (myRating === i ? " is-on" : "");
    b.textContent = "★";
    b.title = `Поставить ${i}`;
    b.addEventListener("click", () => rate(i));
    el.ratingStars.appendChild(b);
  }
}

function renderRating(avg, cnt, my){
  const a = Number(avg)||0;
  const c = Number(cnt)||0;
  el.ratingAvg.textContent = a ? `⭐ ${a.toFixed(1)}` : "⭐ —";
  el.ratingMeta.textContent = c ? `Оценок: ${c} • Твоя: ${my ?? "—"}` : `Оценок: 0 • Твоя: ${my ?? "—"}`;
  renderStars(my);
}

let product = null;

async function loadSeller(id){
  const res = await fetch(`/api/sellers/${id}`);
  if (!res.ok) return null;
  return await res.json();
}

async function loadProduct(id){
  const res = await MarketAPI.apiFetch(`/api/products/${id}`);
  if (!res.ok) return null;
  return await res.json();
}

function setLikeUI(isLiked, likes){
  el.likeBtn.classList.toggle("is-on", !!isLiked);
  el.likeText.textContent = `♥ ${Number(likes||0)}`;
}

async function toggleLike(){
  if (!token()){
    location.href = "login.html";
    return;
  }

  const res = await MarketAPI.apiFetch(`/api/products/${product.id}/like`, { method:"POST" });
  const data = await res.json().catch(()=>({}));

  if (res.status === 401){
    MarketAPI.setToken("");
    location.href = "login.html";
    return;
  }
  if (!res.ok){
    setNote("Ошибка лайка: " + (data.error || "unknown"));
    return;
  }

  product.likes = data.likes;
  product.is_liked = data.liked;
  setLikeUI(product.is_liked, product.likes);
}

async function rate(value){
  if (!token()){
    location.href = "login.html";
    return;
  }

  const res = await MarketAPI.apiFetch(`/api/products/${product.id}/rate`, {
    method:"POST",
    body: JSON.stringify({ rating: value })
  });

  const data = await res.json().catch(()=>({}));

  if (res.status === 401){
    MarketAPI.setToken("");
    location.href = "login.html";
    return;
  }
  if (!res.ok){
    setNote("Ошибка рейтинга: " + (data.error || "unknown"));
    return;
  }

  product.my_rating = data.my_rating;
  product.rating_avg = data.rating_avg;
  product.rating_count = data.rating_count;

  renderRating(product.rating_avg, product.rating_count, product.my_rating);
  setNote("Оценка сохранена ✅");
  setTimeout(()=>setNote(""), 900);
}


function renderProduct(p){
  document.title = `Market — ${p.title}`;
  el.title.textContent = p.title;
  el.desc.textContent = p.description;
  el.price.textContent = formatKZT(p.price);

  // seller
  if (el.sellerLink) {
    el.sellerLink.textContent = '—';
    el.sellerLink.href = '#';
    const sid = Number(p.owner_user_id || 0);
    if (sid > 0) {
      // optimistic link
      el.sellerLink.href = `seller.html?id=${sid}`;
      loadSeller(sid).then(data => {
        if (!data || !data.seller) return;
        const s = data.seller;
        const name = s.nickname ? s.nickname : s.name;
        el.sellerLink.textContent = name;
      }).catch(()=>{});
    } else {
      el.sellerLink.textContent = 'Администрация';
    }
  }

  // category links
  el.tagCat.textContent = p.category;
  el.crumbCat.textContent = p.category;
  el.crumbCat.href = `category.html?cat=${encodeURIComponent(p.category)}`;
  el.crumbTitle.textContent = p.title;

  // image
  const img = String(p.image_url||"").trim();
  el.imgBox.innerHTML = img ? `<img src="${img}" alt="">` : `<div class="ph">Фото</div>`;
  // overlay back tag + like button
  const tag = document.createElement("div");
  tag.className = "p__tag";
  tag.id = "tagCat";
  tag.textContent = p.category;
  el.imgBox.appendChild(tag);
  // move likeBtn into box
  el.imgBox.appendChild(el.likeBtn);

  // like + rating UI
  setLikeUI(p.is_liked, p.likes);
  renderRating(p.rating_avg, p.rating_count, p.my_rating);

  el.likeBtn.addEventListener("click", toggleLike);

  el.addBtn.addEventListener("click", () => {
    addToCart(p.id);
    setNote("Добавлено в корзину");
    setTimeout(()=>setNote(""), 900);
  });

  el.buyBtn.addEventListener("click", () => {
    if (!token()){
      location.href="login.html";
      return;
    }
    addToCart(p.id);
    location.href="checkout.html";
  });

  el.searchGo?.addEventListener("click", () => location.href="index.html");
}

(async function start(){
  const id = getId();
  if (!id){
    el.title.textContent = "Товар не найден";
    return;
  }

  product = await loadProduct(id);
  if (!product){
    el.title.textContent = "Товар не найден";
    return;
  }

  renderProduct(product);
})();