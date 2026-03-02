(function(){
  const panel = document.getElementById("catPanel");
  if (!panel) return;

  function esc(s){
    return String(s||"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  async function load(){
    const res = await fetch(`${window.API}/api/category-groups");
    if (!res.ok) return [];
    return await res.json();
  }

  (async function start(){
    const groups = await load();
    panel.innerHTML = groups.map(g => {
      const name = g.group_name;
      return `<a href="category.html?cat=${encodeURIComponent(name)}">${esc(name)}</a>`;
    }).join("");
  })();
})();