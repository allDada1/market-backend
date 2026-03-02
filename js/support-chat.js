(function () {
  const U = window.MarketUtils;

  const KEY = "market_support_chat";
  const box = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  }
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function render() {
    const list = load();
    if (!box) return;

    box.innerHTML = list.map(m => `
      <div class="msg ${m.me ? "msg--me" : ""}">
        <div class="msg__meta">${m.me ? "Вы" : "Поддержка"} • ${fmtTime(m.ts)}</div>
        <div>${U ? U.escapeHtml(m.text) : String(m.text)}</div>
      </div>
    `).join("");

    box.scrollTop = box.scrollHeight;
  }

  function pushMe(text) {
    const t = String(text || "").trim();
    if (!t) return;

    const list = load();
    list.push({ me: true, text: t, ts: Date.now() });
    save(list);
    render();

    // авто-ответ (демо)
    setTimeout(() => {
      const list2 = load();
      list2.push({
        me: false,
        text: "Принято ✅ Если нужно — приложите скрин и укажите страницу/товар.",
        ts: Date.now()
      });
      save(list2);
      render();
    }, 450);
  }

  if (sendBtn) sendBtn.addEventListener("click", () => {
    pushMe(input && input.value);
    if (input) { input.value = ""; input.focus(); }
  });

  if (input) input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      pushMe(input.value);
      input.value = "";
    }
  });

  render();
})();