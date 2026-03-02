// categories-showcase.js — full-width grid sections like your screenshot
(function(){
  const root = document.getElementById("catShowcase");
  if (!root) return;

  function esc(s){
    return String(s||"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  async function loadTiles(){
    const res = await fetch(window.API + "/api/categories");
    if (!res.ok) return [];
    return await res.json();
  }

  function groupBy(list){
    const map = new Map();
    for (const c of list){
      const g = c.section || "Другое";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(c);
    }
    return map;
  }

  function sectionHtml(groupName, items){
    // цифра справа — кол-во плиток (позже можем сделать кол-во товаров)
    const count = items.length;

    // ссылка ">" ведёт на страницу категории группы
    const moreHref = `category.html?cat=${encodeURIComponent(groupName)}`;

    // плитки
    const tiles = items.map(c => {
      const href = `tile.html?slug=${encodeURIComponent(c.slug)}`;
      const icon = (c.icon_url || "").trim();
      const iconHtml = icon
        ? `<img class="catIconImg" src="${esc(icon)}" alt="">`
        : `<div class="catIcon">${esc(c.emoji || "🎮")}</div>`;
      return `
        <a class="catTile" href="${href}" title="${esc(c.title)}">
          ${iconHtml}
          <div class="catName">${esc(c.title)}</div>
        </a>
      `;
    }).join("");

    return `
      <div class="catSec">
        <div class="catSec__head">
          <div class="catSec__title">🎮 ${esc(groupName)}</div>
          <div class="catSec__right">
            <span class="catSec__count">${count}</span>
            <a class="catSec__more" href="${moreHref}">></a>
          </div>
        </div>

      <div class="catGrid scrollHidden" data-scroll>
        <div class="catGrid">
          ${tiles}
        </div>
      </div>
    `;
  }

  (async function start(){
    const list = await loadTiles();
    const map = groupBy(list);

    let html = "";
    for (const [groupName, items] of map.entries()){
      html += sectionHtml(groupName, items);
    }
    root.innerHTML = html;

    // arrows scroll
root.querySelectorAll(".scrollWrap").forEach(w=>{
  const sc = w.querySelector("[data-scroll]");
  const left = w.querySelector("[data-left]");
  const right = w.querySelector("[data-right]");
  if (!sc || !left || !right) return;

  const step = 420;

  left.addEventListener("click", ()=> sc.scrollBy({ left: -step, behavior:"smooth" }));
  right.addEventListener("click", ()=> sc.scrollBy({ left: step, behavior:"smooth" }));
});
  })();
})();