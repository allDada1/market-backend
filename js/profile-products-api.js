(function () {
  const listEl = document.getElementById("myProductsList");
  const emptyEl = document.getElementById("myProductsEmpty");
  const refreshBtn = document.getElementById("refreshMyProductsBtn");

  if (!listEl) return;

  function fmtKZT(v){
    if (window.MarketUtils && MarketUtils.formatKZT) return MarketUtils.formatKZT(v);
    const s = String(Math.round(Number(v) || 0));
    const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${spaced} ₸`;
  }

  function esc(s){
    return (window.MarketUtils && MarketUtils.escapeHtml) ? MarketUtils.escapeHtml(s) : String(s ?? "");
  }

  function card(p){
    const img = String(p.image_url || "").trim();
    const imgHtml = img ? `<img src="${esc(img)}" alt="">` : `Фото`;

    return `
      <div class="pcard" data-id="${p.id}">
        <div class="pcard__img">${imgHtml}</div>
        <div>
          <div class="pcard__t">${esc(p.title)}</div>
          <div class="pcard__d">${esc(p.description || "")}</div>
        </div>
        <div class="pcard__right">
          <div class="pcard__price">${fmtKZT(p.price)}</div>
          <div class="pcard__meta">В наличии: ${Number(p.stock)||0}</div>
        </div>
      </div>
    `;
  }

  async function load(){
    const res = await MarketAPI.apiFetch("/api/profile/products");
    if (res.status === 401) return { error:"unauthorized", products:[] };
    if (!res.ok) return { error:"server_error", products:[] };
    const data = await res.json().catch(()=>({products:[]}));
    return { error:null, products: Array.isArray(data.products) ? data.products : [] };
  }

  async function render(){
    const r = await load();
    const products = r.products || [];

    if (!products.length){
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = products.map(card).join("");

    listEl.querySelectorAll(".pcard").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        location.href = `product.html?id=${id}`;
      });
    });
  }

  refreshBtn?.addEventListener("click", render);

  render();
})();
