// notifications-ui.js — dropdown bell notifications
(function(){
  if (!window.MarketAPI) return;

  const btn = document.getElementById("notifBtn");
  const badge = document.getElementById("notifBadge");
  const panel = document.getElementById("notifPanel");
  const clearBtn = document.getElementById("notifClearBtn");

  if (!btn || !badge || !panel) return;

  function isLoggedIn(){
    try { return !!MarketAPI.getToken(); } catch { return false; }
  }

  function setBadge(n){
    const v = Number(n)||0;
    badge.textContent = String(v);
    badge.hidden = v <= 0;
  }

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function fmtTime(t){
    // t is text from NOW()::text; try Date parse
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const mo = String(d.getMonth()+1).padStart(2,"0");
    return `${dd}.${mo} ${hh}:${mm}`;
  }

  async function fetchNotifs(){
    if (!isLoggedIn()){
      panel.innerHTML = `<div class="notifEmpty">Войдите, чтобы видеть уведомления.</div>`;
      setBadge(0);
      return;
    }
    const r = await MarketAPI.apifetch(`${window.API}/api/notifications");
    if (!r.ok){
      panel.innerHTML = `<div class="notifEmpty">Не удалось загрузить уведомления.</div>`;
      return;
    }
    const data = await r.json().catch(()=>({unread_count:0, items:[]}));
    setBadge(data.unread_count || 0);

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length){
      panel.innerHTML = `<div class="notifEmpty">Пока нет уведомлений.</div>`;
      return;
    }

    panel.innerHTML = items.map(n => {
      const t = fmtTime(n.created_at);
      const cls = n.is_read ? "notifItem" : "notifItem notifItem--unread";
      return `
        <button class="${cls}" type="button" data-id="${n.id}" data-link="${esc(n.link||"")}">
          <div class="notifItem__top">
            <div class="notifItem__title">${esc(n.title||"")}</div>
            <div class="notifItem__time">${esc(t)}</div>
          </div>
          ${n.body ? `<div class="notifItem__body">${esc(n.body)}</div>` : ""}
        </button>
      `;
    }).join("");

    panel.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", async () => {
        const id = Number(el.dataset.id);
        const link = el.dataset.link || "";
        try {
          await MarketAPI.apifetch(`${window.API}/api/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [id] })
          });
        } catch {}
        // refresh badge quickly
        refresh();
        if (link) location.href = link.startsWith("http") ? link : link;
      });
    });
  }

  async function refresh(){
    try { await fetchNotifs(); } catch {}
  }

  // Refresh on open
  btn.addEventListener("click", () => {
    // dropdowns.js toggles is-open class; we refresh anyway
    refresh();
  });

  // Clear read
  if (clearBtn){
    clearBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!isLoggedIn()) return;
      const r = await MarketAPI.apifetch(`${window.API}/api/notifications/clear", { method: "POST" });
      if (r.ok) refresh();
    });
  }

  // Initial + polling
  refresh();
  setInterval(() => {
    // don't spam if logged out
    if (isLoggedIn()) refresh();
  }, 30000);
})();
