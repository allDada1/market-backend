// js/admin.js — FULL (hybrid admin: tiles + products, with icon upload + product tile selection)
// Требует endpoints:
//  - GET  /api/auth/me  (для проверки админа)
//  - GET  /api/admin/categories
//  - POST /api/admin/categories
//  - PATCH/DELETE /api/admin/categories/:id
//  - GET  /api/products
//  - GET  /api/products/:id
//  - POST /api/products
//  - PATCH/DELETE /api/products/:id
//  - POST /api/uploads/image   (загрузка файлов картинок; авторизация Bearer token)

const E = (id) => document.getElementById(id);

const ui = {
  guard: E("admGuardText"),

  // ===== Tiles (categories tiles) =====
  catSection: E("catSection"),
  catTitle: E("catTitle"),
  catSlug: E("catSlug"),
  catEmoji: E("catEmoji"),       // можно оставить, если не используешь — ок
  catSort: E("catSort"),
  catActive: E("catActive"),
  catAddBtn: E("catAddBtn"),
  catReloadBtn: E("catReloadBtn"),
  catNote: E("catNote"),
  catList: E("catList"),

  // icon upload for tile
  catUploadBox: E("catUploadBox"),
  catFileInput: E("catFileInput"),
  catPickBtn: E("catPickBtn"),
  catRemoveIconBtn: E("catRemoveIconBtn"),
  catSaveOrderBtn: E("catSaveOrderBtn"),
  catCancelEditBtn: E("catCancelEditBtn"),
  catIconText: E("catIconText"),
  catIconPreview: E("catIconPreview"),

  // ===== Products =====
  prodSection: E("prodSection"),
  prodTile: E("prodTile"),
  title: E("title"),
  description: E("description"),
  price: E("price"),
  stock: E("stock"),
  prodSaveBtn: E("prodSaveBtn"),
  prodReloadBtn: E("prodReloadBtn"),
  prodCancelBtn: E("prodCancelBtn"),
  prodNote: E("prodNote"),
  prodList: E("prodList"),

  // product image upload
  uploadBox: E("uploadBox"),
  fileInput: E("fileInput"),
  pickFileBtn: E("pickFileBtn"),
  previewImg: E("previewImg"),
  imageUrlText: E("imageUrlText"),
};

let tiles = [];
let editingProductId = null;
let currentProductImageUrl = "";
let currentTileIconUrl = "";
let editingTileId = null;
let editingTileOriginalSlug = "";


function setNote(el, t) {
  if (!el) return;
  el.textContent = t || "";
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtKZT(v) {
  const s = String(Math.round(Number(v) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
}

function token() {
  return (window.MarketAPI && MarketAPI.getToken) ? MarketAPI.getToken() : "";
}

function humanUploadError(msg){
  const m = String(msg || "unknown");
  if (m === "no_token") {
    return "no_token (нужно открыть админку через сервер: http://localhost:3000/admin.html и зайти в аккаунт. Если открыть через Live Server/file:// — токена не будет)";
  }
  if (m === "token_expired") return "token_expired (зайди заново)";
  if (m === "bad_token") return "bad_token (зайди заново)";
  if (m === "admin_only") return "admin_only (этот аккаунт не админ)";
  if (m === "bad_file_type") return "bad_file_type (разрешено: png/jpg/webp/svg/ico/gif)";
  if (m === "file_too_large") return "file_too_large (лимит 10MB)";
  return m;
}

// ===================== AUTH =====================
async function ensureAdmin() {
  const r = await MarketAPI.apifetch(window.API + "/api/auth/me");
  if (r.status === 401) {
    location.href = "login.html";
    return false;
  }
  const d = await r.json().catch(() => ({}));
  if (!d.user?.is_admin) {
    if (ui.guard) ui.guard.textContent = "Доступ запрещён: только администратор.";
    return false;
  }
  if (ui.guard) ui.guard.textContent = "Доступ: администратор ✅";
  return true;
}

// ===================== UPLOAD (shared) =====================

async function squareIconIfNeeded(file){
  const type = file?.type || "";
  const raster = ["image/png","image/jpeg","image/webp"].includes(type);
  if (!raster) return file; // svg/ico/gif — не трогаем

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");

  // cover crop
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const scale = Math.max(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  ctx.clearRect(0,0,size,size);
  ctx.drawImage(img, dx, dy, dw, dh);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
  URL.revokeObjectURL(img.src);
  if (!blob) return file;
  return new File([blob], "tile_icon.png", { type: "image/png" });
}

async function uploadImage(file) {
  // Try to get token in the most reliable way
  const t =
    token() ||
    localStorage.getItem("market_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("marketToken") ||
    localStorage.getItem("admin_token") ||
    "";

  if (!t) {
    // Most common causes: opened from another origin/port OR not logged in
    throw new Error("no_token");
  }

  const fd = new FormData();
  fd.append("image", file);

  // Send token in multiple ways (header + fallback header + query param),
  // so even if some environment strips headers, upload still works.
  const url = "/api/uploads/image?token=" + encodeURIComponent(t);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + t,
      "X-Market-Token": t
    },
    body: fd
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Pass through server error codes so UI can show them
    throw new Error(data.error || "unknown");
  }

  return data.url;
}


// ---- product image preview
function showProductPreview(url) {
  currentProductImageUrl = url || "";
  if (!ui.previewImg || !ui.imageUrlText) return;

  if (!url) {
    ui.previewImg.style.display = "none";
    ui.imageUrlText.textContent = "Фото не выбрано";
    return;
  }
  ui.previewImg.src = url;
  ui.previewImg.style.display = "";
  ui.imageUrlText.textContent = url;
}

function bindProductUpload() {
  if (!ui.pickFileBtn || !ui.fileInput) return;

  ui.pickFileBtn.addEventListener("click", () => ui.fileInput.click());

  ui.fileInput.addEventListener("change", async () => {
    const file = ui.fileInput.files?.[0];
    if (!file) return;
    try {
      setNote(ui.prodNote, "Загрузка фото…");
      const url = await uploadImage(file);
      showProductPreview(url);
      setNote(ui.prodNote, "Фото загружено ✅");
    } catch (e) {
      console.error(e);
      setNote(ui.prodNote, "Ошибка загрузки фото");
    }
  });

  // drag & drop (optional)
  if (ui.uploadBox) {
    ui.uploadBox.addEventListener("dragover", (e) => { e.preventDefault(); ui.uploadBox.classList.add("drag"); });
    ui.uploadBox.addEventListener("dragleave", () => ui.uploadBox.classList.remove("drag"));
    ui.uploadBox.addEventListener("drop", async (e) => {
      e.preventDefault();
      ui.uploadBox.classList.remove("drag");
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      try {
        setNote(ui.prodNote, "Загрузка фото…");
        const url = await uploadImage(file);
        showProductPreview(url);
        setNote(ui.prodNote, "Фото загружено ✅");
      } catch (err) {
        console.error(err);
        setNote(ui.prodNote, "Ошибка загрузки фото");
      }
    });
  }
}

// ---- tile icon preview
function showTileIcon(url) {
  currentTileIconUrl = url || "";
  if (!ui.catIconPreview || !ui.catIconText) return;

  if (!url) {
    ui.catIconPreview.style.display = "none";
    ui.catIconText.textContent = "Иконка не выбрана";
    return;
  }
  ui.catIconPreview.src = url;
  ui.catIconPreview.style.display = "";
  ui.catIconText.textContent = url;
}



function enterTileEditMode(tile){
  editingTileId = Number(tile.id);
  editingTileOriginalSlug = String(tile.slug||"");
  if (ui.catAddBtn) ui.catAddBtn.textContent = "Сохранить изменения";
  if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "";
  if (ui.catSection) ui.catSection.value = tile.section || "Игры";
  if (ui.catTitle) ui.catTitle.value = tile.title || "";
  if (ui.catSlug) ui.catSlug.value = tile.slug || "";
  if (ui.catEmoji) ui.catEmoji.value = tile.emoji || "";
  if (ui.catSort) ui.catSort.value = String(tile.sort_order ?? 0);
  if (ui.catActive) ui.catActive.value = String(Number(tile.is_active) ? 1 : 0);

  showTileIcon((tile.icon_url||"").trim());
  setNote(ui.catNote, "Режим редактирования: " + (tile.title||""));
}

function exitTileEditMode(){
  editingTileId = null;
  editingTileOriginalSlug = "";
  if (ui.catAddBtn) ui.catAddBtn.textContent = "Добавить плитку";
  if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "none";
  // не чистим поля насильно — пользователь может продолжить правку, но иконку сбросим
  showTileIcon(currentTileIconUrl);
}

if (ui.catCancelEditBtn){
  ui.catCancelEditBtn.addEventListener("click", () => {
    // сброс формы полностью
    editingTileId = null;
    editingTileOriginalSlug = "";
    if (ui.catTitle) ui.catTitle.value = "";
    if (ui.catSlug) ui.catSlug.value = "";
    if (ui.catEmoji) ui.catEmoji.value = "";
    if (ui.catSort) ui.catSort.value = "";
    if (ui.catActive) ui.catActive.value = "1";
    showTileIcon("");
    if (ui.catAddBtn) ui.catAddBtn.textContent = "Добавить плитку";
    if (ui.catCancelEditBtn) ui.catCancelEditBtn.style.display = "none";
    setNote(ui.catNote, "Отменено");
  });
}

let dragTileId = null;

function bindTileDnD(){
  if (!ui.catList) return;
  const items = Array.from(ui.catList.querySelectorAll(".rowItem"));
  for (const it of items){
    it.addEventListener("dragstart", (e) => {
      dragTileId = it.dataset.id;
      it.style.opacity = "0.6";
      e.dataTransfer.effectAllowed = "move";
    });
    it.addEventListener("dragend", () => {
      it.style.opacity = "";
      dragTileId = null;
    });
    it.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = ui.catList.querySelector(`.rowItem[data-id="${dragTileId}"]`);
      if (!dragging || dragging === it) return;
      // ограничим перетаскивание внутри одного раздела
      if ((dragging.dataset.section||"") !== (it.dataset.section||"")) return;

      const rect = it.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) ui.catList.insertBefore(dragging, it);
      else ui.catList.insertBefore(dragging, it.nextSibling);
    });
  }
}

function buildOrdersFromDom(){
  if (!ui.catList) return [];
  const items = Array.from(ui.catList.querySelectorAll(".rowItem"));
  const bySection = new Map();
  for (const it of items){
    const sec = it.dataset.section || "";
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec).push(Number(it.dataset.id));
  }
  const orders = [];
  for (const [sec, ids] of bySection.entries()){
    ids.forEach((id, idx) => orders.push({ id, sort_order: idx * 10 }));
  }
  return orders;
}

async function saveTileOrder(){
  const orders = buildOrdersFromDom();
  if (!orders.length) return;
  const r = await MarketAPI.apifetch(window.API + "/api/admin/categories/reorder", {
    method: "POST",
    body: JSON.stringify({ orders })
  });
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || "reorder_failed");
}

function bindTileIconUpload() {
  if (!ui.catPickBtn || !ui.catFileInput) return;

  ui.catPickBtn.addEventListener("click", () => ui.catFileInput.click());

  ui.catFileInput.addEventListener("change", async () => {
    const file = ui.catFileInput.files?.[0];
    if (!file) return;
    try {
      setNote(ui.catNote, "Загрузка иконки…");
      const url = await uploadImage(file);
      showTileIcon(url);
      setNote(ui.catNote, "Иконка загружена ✅");
    } catch (e) {
      console.error(e);
      setNote(ui.catNote, "Ошибка загрузки иконки: " + humanUploadError(e?.message));
    }
  });

  // drag & drop for tile icon (optional)
  if (ui.catUploadBox) {
    ui.catUploadBox.addEventListener("dragover", (e) => { e.preventDefault(); ui.catUploadBox.classList.add("drag"); });
    ui.catUploadBox.addEventListener("dragleave", () => ui.catUploadBox.classList.remove("drag"));
    ui.catUploadBox.addEventListener("drop", async (e) => {
      e.preventDefault();
      ui.catUploadBox.classList.remove("drag");
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      try {
        setNote(ui.catNote, "Загрузка иконки…");
        const url = await uploadImage(file);
        showTileIcon(url);
        setNote(ui.catNote, "Иконка загружена ✅");
      } catch (err) {
        console.error(err);
        setNote(ui.catNote, "Ошибка загрузки иконки: " + humanUploadError(err?.message));
      }
    });
  }
}

// ===================== TILES =====================
async function loadTiles() {
  const r = await MarketAPI.apifetch(window.API + "/api/admin/categories");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "tiles_load_failed");
  return d;
}


function renderTiles() {
  if (!ui.catList) return;

  ui.catList.innerHTML = tiles.map(t => {
    const icon = (t.icon_url || "").trim();
    const iconHtml = icon
      ? `<img src="${esc(icon)}" alt="" style="width:77px;height:77px;object-fit:cover;border-radius:16px;border:1px solid rgba(255,255,255,.10);" />`
      : `<div style="width:77px;height:77px;border-radius:16px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);font-size:20px;">${esc(t.emoji || "🎮")}</div>`;

    return `
      <div class="rowItem" draggable="true" data-id="${t.id}" data-section="${esc(t.section||"")}" style="cursor:grab;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="dragHandle" title="Перетащи чтобы изменить порядок" style="opacity:.65;font-size:18px;user-select:none;">⋮⋮</div>
          ${iconHtml}
          <div>
            <b>${esc(t.section)} • ${esc(t.title)}</b>
            <div class="muted">slug: ${esc(t.slug)} • sort: ${Number(t.sort_order || 0)} • active: ${Number(t.is_active) ? "yes" : "no"}</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button class="smallBtn" data-toggle type="button">${Number(t.is_active) ? "Скрыть" : "Показать"}</button>
          <button class="smallBtn" data-edit type="button">Изменить</button>
          <button class="smallBtn" data-del type="button">Удалить</button>
        </div>
      </div>
    `;
  }).join("");

  // edit
  ui.catList.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.closest(".rowItem")?.dataset?.id);
      const tile = tiles.find(x => Number(x.id) === id);
      if (!tile) return;
      enterTileEditMode(tile);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // delete
  ui.catList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest(".rowItem")?.dataset?.id;
      if (!id) return;

      const r = await MarketAPI.apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.catNote, "Ошибка: " + (d.error || "unknown"));

      setNote(ui.catNote, "Удалено ✅");
      await refreshAll();
    });
  });

  // toggle active
  ui.catList.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest(".rowItem")?.dataset?.id;
      if (!id) return;

      const willActive = btn.textContent.includes("Показать");

      const r = await MarketAPI.apiFetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: willActive ? 1 : 0 })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.catNote, "Ошибка: " + (d.error || "unknown"));

      setNote(ui.catNote, "OK ✅");
      await refreshAll();
    });
  });

  bindTileDnD();
}


function normalizeSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
}


// resolve tile slug from DB value (could be saved as title in older versions)
function resolveTileSlug(v){
  const raw = String(v || "").trim();
  if (!raw) return "";
  const low = raw.toLowerCase();

  // direct match by slug
  const bySlug = tiles.find(t => String(t.slug || "").trim().toLowerCase() === low);
  if (bySlug) return String(bySlug.slug || "").trim().toLowerCase();

  // sometimes saved as title
  const byTitle = tiles.find(t => String(t.title || "").trim().toLowerCase() === low);
  if (byTitle) return String(byTitle.slug || "").trim().toLowerCase();

  // best-effort normalization
  return normalizeSlug(raw);
}

async function checkSlug(slug, excludeId){
  const q = new URLSearchParams({ slug, exclude_id: String(excludeId||0) });
  const r = await MarketAPI.apifetch(window.API + "/api/admin/categories/check-slug?" + q.toString());
  const d = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(d.error || "check_failed");
  return !!d.available;
}


async function saveTile() {
  const section = (ui.catSection?.value || "Игры").trim();
  const title = (ui.catTitle?.value || "").trim();
  let slug = (ui.catSlug?.value || "").trim();
  slug = normalizeSlug(slug || title);

  const sort_order = Number(ui.catSort?.value || 0);
  const is_active = (ui.catActive?.value || "1") === "1";

  if (!section || !title || !slug) {
    setNote(ui.catNote, "Заполни: раздел, название, slug.");
    return;
  }

  // client-side slug check (fast, but server is still the source of truth)
  try{
    const ok = await checkSlug(slug, editingTileId || 0);
    if (!ok){
      setNote(ui.catNote, "Этот slug уже занят. Придумай другой.");
      return;
    }
  }catch(_e){}

  const body = {
    section,
    title,
    slug,
    icon_url: currentTileIconUrl,
    emoji: (ui.catEmoji?.value || "").trim(),
    sort_order,
    is_active
  };

  const isEdit = !!editingTileId;
  const url = isEdit ? `/api/admin/categories/${editingTileId}` : "/api/admin/categories";
  const method = isEdit ? "PATCH" : "POST";

  const r = await MarketAPI.apiFetch(url, { method, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    const code = d.error || "db_error";
    if (code === "slug_taken" || code === "slug_taken" || code === "slug_taken") {
      setNote(ui.catNote, "Ошибка: slug уже существует.");
    } else {
      setNote(ui.catNote, "Ошибка: " + code);
    }
    return;
  }

  setNote(ui.catNote, isEdit ? "Изменения сохранены ✅" : "Добавлено ✅");
  exitTileEditMode();
  await refreshAll();
}

// ===================== PRODUCTS =====================
async function loadProducts() {
  const r = await MarketAPI.apifetch(window.API + "/api/products");
  const d = await r.json().catch(() => ([]));
  if (!r.ok) throw new Error("products_load_failed");
  return d;
}

function fillTileSelect(selectedSlug) {
  if (!ui.prodTile) return;

  const section = (ui.prodSection?.value || "Игры").trim();

  // сохранить текущее выбранное значение (если есть)
  const prev = (selectedSlug !== undefined) ? selectedSlug : (ui.prodTile.value || "");

  // только активные плитки текущего раздела
  const filtered = tiles.filter(t => Number(t.is_active) === 1 && String(t.section || "") === section);

  ui.prodTile.innerHTML = filtered
    .map(t => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`)
    .join("");

  if (!filtered.length) {
    ui.prodTile.innerHTML = `<option value="">(нет плиток в разделе)</option>`;
    return;
  }

  // попытаться восстановить выбор
  const want = String(prev || "").trim().toLowerCase();
  const exists = filtered.some(t => String(t.slug || "").trim().toLowerCase() === want);
  if (exists) ui.prodTile.value = want;
}

function renderProducts(list) {
  if (!ui.prodList) return;

  ui.prodList.innerHTML = list.map(p => `
    <div class="rowItem" data-id="${p.id}">
      <div style="display:flex;gap:10px;align-items:center;">
        <div style="width:56px;height:56px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);flex:0 0 auto;display:grid;place-items:center;">
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover;"/>` : `<span class="muted" style="font-size:12px;">Фото</span>`}
        </div>
        <div>
          <b>#${p.id} ${esc(p.title)}</b>
          <div class="muted">${esc(p.category)} • ${fmtKZT(p.price)} • stock: ${Number(p.stock || 0)}</div>
          <div class="muted">♥ ${Number(p.likes||0)} • ⭐ ${Number(p.rating_avg||0) ? Number(p.rating_avg).toFixed(1) : "—"} (${Number(p.rating_count||0)})</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="smallBtn" data-edit type="button">Редактировать</button>
        <button class="smallBtn" data-del type="button">Удалить</button>
      </div>
    </div>
  `).join("");

  ui.prodList.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest(".rowItem")?.dataset?.id;
      if (!id) return;

      const r = await MarketAPI.apiFetch(`/api/products/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));

      setNote(ui.prodNote, "Удалено ✅");
      if (String(editingProductId) === String(id)) resetProductForm();
      await refreshAll();
    });
  });

  ui.prodList.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.closest(".rowItem")?.dataset?.id);
      if (!id) return;

      const r = await MarketAPI.apiFetch(`/api/products/${id}`);
      const p = await r.json().catch(() => null);
      if (!r.ok || !p) return setNote(ui.prodNote, "Не удалось загрузить товар");

      editingProductId = id;
      if (ui.prodSaveBtn) ui.prodSaveBtn.textContent = "Сохранить";

      if (ui.title) ui.title.value = p.title || "";
      if (ui.description) ui.description.value = p.description || "";
      if (ui.price) ui.price.value = p.price ?? "";
      if (ui.stock) ui.stock.value = p.stock ?? "";

      showProductPreview((p.image_url || "").trim());

      // Попробуем автоматически выставить раздел и плитку, если эти поля есть в БД:
      // (если нет — не ломаем)
      const pSection = (p.section || "").trim();
      const pTileSlug = (p.tile_slug || "").trim();
      const resolvedSlug = resolveTileSlug(pTileSlug);

      // выставляем раздел (если есть), затем обновляем список плиток и выбираем нужную
      if (pSection && ui.prodSection) ui.prodSection.value = pSection;

      // fillTileSelect пересоздаёт options, поэтому выбирать нужно ПОСЛЕ него
      fillTileSelect(resolvedSlug || ui.prodTile?.value);

      if (resolvedSlug && ui.prodTile) ui.prodTile.value = resolvedSlug;
      setNote(ui.prodNote, `Редактирование товара #${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function resetProductForm() {
  editingProductId = null;
  if (ui.prodSaveBtn) ui.prodSaveBtn.textContent = "Добавить";

  if (ui.title) ui.title.value = "";
  if (ui.description) ui.description.value = "";
  if (ui.price) ui.price.value = "";
  if (ui.stock) ui.stock.value = "";

  showProductPreview("");
  setNote(ui.prodNote, "");
}

async function saveProduct() {
  if (!ui.prodTile) return;

  const tile_slug = String(ui.prodTile.value || "").trim().toLowerCase();
  if (!tile_slug) {
    setNote(ui.prodNote, "Сначала создай плитку в этом разделе (или выбери другой раздел).");
    return;
  }

  const tileObj = tiles.find(t => String(t.slug || "").trim().toLowerCase() === tile_slug);
  const tileTitle = tileObj ? String(tileObj.title || "").trim() : "";

  const body = {
    title: (ui.title?.value || "").trim(),
    description: (ui.description?.value || "").trim(),
    price: Number(ui.price?.value),
    stock: Number(ui.stock?.value || 1),
    image_url: currentProductImageUrl,

    // важное: связка товара с плиткой
    tile_slug,

    // чтобы на карточке красиво писалось "Steam / Telegram / Roblox"
    category: tileTitle || (ui.prodSection?.value || "Категория"),

    // если на сервере/в БД есть поле section — отправим (не помешает)
    section: (ui.prodSection?.value || "Игры")
  };

  if (!body.title || !body.description) {
    setNote(ui.prodNote, "Заполни название и описание.");
    return;
  }
  if (!Number.isFinite(body.price) || body.price <= 0) {
    setNote(ui.prodNote, "Цена должна быть числом > 0.");
    return;
  }

  if (editingProductId == null) {
    const r = await MarketAPI.apifetch(window.API + "/api/products", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));

    setNote(ui.prodNote, "Добавлено ✅");
    resetProductForm();
    await refreshAll();
  } else {
    const r = await MarketAPI.apiFetch(`/api/products/${editingProductId}`, { method: "PATCH", body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNote(ui.prodNote, "Ошибка: " + (d.error || "unknown"));

    setNote(ui.prodNote, "Сохранено ✅");
    resetProductForm();
    await refreshAll();
  }
}

// ===================== REFRESH =====================
async function refreshAll() {
  try {
    tiles = await loadTiles();
    renderTiles();
    fillTileSelect();

    const products = await loadProducts();
    renderProducts(products);
  } catch (e) {
    console.error(e);
    setNote(ui.catNote, "Ошибка загрузки данных (проверь endpoints).");
  }
}

// ===================== EVENTS & START =====================
if (ui.catAddBtn) ui.catAddBtn.addEventListener("click", saveTile);
if (ui.catReloadBtn) ui.catReloadBtn.addEventListener("click", refreshAll);

if (ui.prodSection) ui.prodSection.addEventListener("change", () => fillTileSelect());
if (ui.prodSaveBtn) ui.prodSaveBtn.addEventListener("click", saveProduct);
if (ui.prodReloadBtn) ui.prodReloadBtn.addEventListener("click", refreshAll);
if (ui.prodCancelBtn) ui.prodCancelBtn.addEventListener("click", resetProductForm);

(async function () {
  const ok = await ensureAdmin();
  if (!ok) return;

  bindProductUpload();
  
if (ui.catSaveOrderBtn){
  ui.catSaveOrderBtn.addEventListener("click", async () => {
    try{
      setNote(ui.catNote, "Сохраняю порядок…");
      await saveTileOrder();
      setNote(ui.catNote, "Порядок сохранён ✅");
      await refreshAll();
    }catch(e){
      console.error(e);
      setNote(ui.catNote, "Ошибка сохранения порядка: " + (e?.message || "unknown"));
    }
  });
}

bindTileIconUpload();

  showProductPreview("");
  showTileIcon("");

  await refreshAll();
})()
if (ui.catSlug){
  ui.catSlug.addEventListener("blur", async () => {
    const raw = (ui.catSlug.value || "").trim();
    if (!raw) return;
    const slug = normalizeSlug(raw);
    ui.catSlug.value = slug;
    try{
      const ok = await checkSlug(slug, editingTileId || 0);
      if (!ok) setNote(ui.catNote, "⚠️ Slug занят. Выбери другой.");
    }catch(_e){}
  });
}


if (ui.catRemoveIconBtn){
  ui.catRemoveIconBtn.addEventListener("click", async () => {
    // просто очищаем icon_url, остаётся emoji
    showTileIcon("");
    if (ui.catFileInput) ui.catFileInput.value = "";
    setNote(ui.catNote, "Иконка удалена (будет показан emoji).");
  });
}

