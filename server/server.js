const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const { db, init, pool } = require("./db");

// init() is awaited at the bottom before listen

const app = express();



app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://firstmarkettest.netlify.app",
    "https://market-backend-if6s.onrender.com"
  ],
  credentials: true
}));

app.use(express.json());

// --- static site root ---
app.use("/", express.static(path.join(__dirname, "..")));

// --- uploads folder ---
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".gif"].includes(ext) ? ext : ".png";
    cb(null, `p_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("bad_file_type"), ok);
  }
});

// ---------- utils ----------
function hashPassword(password, saltHex){
  const salt = Buffer.from(saltHex, "hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  return hash.toString("hex");
}
function makeSalt(){ return crypto.randomBytes(16).toString("hex"); }
function makeToken(){ return crypto.randomBytes(24).toString("hex"); }
function nowPlusDays(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function authRequired(req, res, next){
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  if (!token) return res.status(401).json({ error: "no_token" });

  db.get(
    `SELECT s.token, s.user_id, s.expires_at,
            u.id, u.name, u.email, u.is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token],
    (err, row) => {
      if (err) return res.status(500).json({ error: "db_error" });
      if (!row) return res.status(401).json({ error: "bad_token" });

      const exp = new Date(row.expires_at).getTime();
      if (!Number.isFinite(exp) || exp < Date.now()){
        db.run(`DELETE FROM sessions WHERE token = ?`, [token], () => {});
        return res.status(401).json({ error: "token_expired" });
      }

      req.user = { id: row.id, name: row.name, email: row.email, is_admin: !!row.is_admin };
      req.token = token;
      next();
    }
  );
}


function authRequiredFlexible(req, res, next){
  // Standard: Authorization: Bearer <token>
  const h = req.headers.authorization || "";
  let token = null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) token = m[1];

  // Fallbacks (useful when static pages are served from a different origin/port)
  if (!token) token = String(req.headers["x-market-token"] || req.headers["x-auth-token"] || "").trim();
  if (!token) token = String(req.query.token || "").trim();

  if (!token) return res.status(401).json({ error: "no_token" });

  db.get(
    `SELECT s.token, s.user_id, s.expires_at,
            u.id, u.name, u.email, u.is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token],
    (err, row) => {
      if (err) return res.status(500).json({ error: "db_error" });
      if (!row) return res.status(401).json({ error: "bad_token" });

      // expiry check
      if (row.expires_at && String(row.expires_at) < new Date().toISOString()){
        return res.status(401).json({ error: "token_expired" });
      }

      req.user = { id: row.id, name: row.name, email: row.email, is_admin: !!row.is_admin };
      req.token = token;
      next();
    }
  );
}


function adminRequired(req, res, next){
  if (!req.user?.is_admin) return res.status(403).json({ error: "admin_only" });
  next();
}

// helper: product stats (likes + rating avg/count + isLiked + myRating)
function withProductStats(rows, userId, cb){
  const list = Array.isArray(rows) ? rows : [rows];
  const ids = list.map(p => p?.id).filter(Number.isFinite);
  if (!ids.length) return cb(list.map(p => ({ ...p, likes:0, rating_avg:0, rating_count:0, is_liked:false, my_rating:null })));

  const placeholders = ids.map(()=>"?").join(",");

  db.all(
    `SELECT product_id, COUNT(*) as likes
     FROM product_likes
     WHERE product_id IN (${placeholders})
     GROUP BY product_id`,
    ids,
    (e1, likesRows) => {
      if (e1) likesRows = [];
      const likesMap = new Map(likesRows.map(r => [r.product_id, r.likes]));

      db.all(
        `SELECT product_id,
                ROUND(AVG(rating), 2) as rating_avg,
                COUNT(*) as rating_count
         FROM product_ratings
         WHERE product_id IN (${placeholders})
         GROUP BY product_id`,
        ids,
        (e2, ratRows) => {
          if (e2) ratRows = [];
          const ratMap = new Map(ratRows.map(r => [r.product_id, { avg: Number(r.rating_avg)||0, cnt: Number(r.rating_count)||0 }]));

          if (!userId){
            return cb(list.map(p => {
              const r = ratMap.get(p.id) || { avg:0, cnt:0 };
              return { ...p, likes: Number(likesMap.get(p.id)||0), rating_avg: r.avg, rating_count: r.cnt, is_liked:false, my_rating:null };
            }));
          }

          db.all(
            `SELECT product_id FROM product_likes WHERE user_id = ? AND product_id IN (${placeholders})`,
            [userId, ...ids],
            (e3, myLikes) => {
              if (e3) myLikes = [];
              const myLikeSet = new Set(myLikes.map(x => x.product_id));

              db.all(
                `SELECT product_id, rating FROM product_ratings WHERE user_id = ? AND product_id IN (${placeholders})`,
                [userId, ...ids],
                (e4, myRates) => {
                  if (e4) myRates = [];
                  const myRateMap = new Map(myRates.map(x => [x.product_id, x.rating]));

                  cb(list.map(p => {
                    const r = ratMap.get(p.id) || { avg:0, cnt:0 };
                    return {
                      ...p,
                      likes: Number(likesMap.get(p.id)||0),
                      rating_avg: r.avg,
                      rating_count: r.cnt,
                      is_liked: myLikeSet.has(p.id),
                      my_rating: myRateMap.has(p.id) ? myRateMap.get(p.id) : null
                    };
                  }));
                }
              );
            }
          );
        }
      );
    }
  );
}

// ---------- AUTH ----------
app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (name.length < 2) return res.status(400).json({ error: "bad_name" });
  if (!email.includes("@") || email.length < 5) return res.status(400).json({ error: "bad_email" });
  if (password.length < 6) return res.status(400).json({ error: "bad_password" });

  const salt = makeSalt();
  const passHash = hashPassword(password, salt);

  try {
    // Insert user and get id (Postgres needs RETURNING)
    const rUser = await pool.query(
      `INSERT INTO users (name, email, pass_salt, pass_hash, password_hash, is_admin)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id`,
      [name, email, salt, passHash, passHash]
    );
    const userId = rUser.rows[0].id;

    const token = makeToken();
    const expiresAt = nowPlusDays(30);

    await pool.query(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, userId, expiresAt]
    );

    res.json({ token, user: { id: userId, name, email, is_admin: false } });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate key")) {
      return res.status(409).json({ error: "email_taken" });
    }
    console.error("REGISTER DB ERROR:", msg);
    return res.status(500).json({ error: "db_error", details: msg });
  }
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: "db_error" });
    if (!user) return res.status(401).json({ error: "bad_credentials" });

    const calc = hashPassword(password, user.pass_salt);
    if (calc !== user.pass_hash) return res.status(401).json({ error: "bad_credentials" });

    const token = makeToken();
    const expiresAt = nowPlusDays(30);

    db.run(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`, [token, user.id, expiresAt], (err2) => {
      if (err2) return res.status(500).json({ error: "db_error" });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, is_admin: !!user.is_admin } });
    });
  });
});

app.get("/api/auth/me", authRequired, (req, res) => res.json({ user: req.user }));

app.post("/api/auth/logout", authRequired, (req, res) => {
  db.run(`DELETE FROM sessions WHERE token = ?`, [req.token], (err) => {
    if (err) return res.status(500).json({ error: "db_error" });
    res.json({ ok:true });
  });
});

// make admin (1 раз для себя)
app.post("/api/admin/make-admin", (req, res) => {
  const secret = String(req.body.secret || "");
  const expected = process.env.ADMIN_SECRET || "devsecret";
  if (secret !== expected) return res.status(403).json({ error: "bad_secret" });

  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "bad_email" });

  db.run(
    `UPDATE users SET is_admin = TRUE WHERE LOWER(email) = ?`,
    [email],
    function (err) {
      if (err) {
        console.error("MAKE-ADMIN ERROR:", err.message || err);
        return res.status(500).json({ error: "db_error" });
      }
      if (this.changes === 0) return res.status(404).json({ error: "user_not_found" });
      res.json({ ok: true });
    }
  );
});

// ---------- UPLOAD (admin only) ----------
app.post("/api/uploads/image", authRequiredFlexible, adminRequired, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

app.get("/api/products", (req, res) => {
  const q = String(req.query.q || "").trim();
  const cat = String(req.query.cat || "").trim();

  const sort = String(req.query.sort || "new");
  const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const where = [];
  const params = [];

  if (q) {
    where.push("(p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (cat) {
    where.push("p.category = ?");
    params.push(cat);
  }

  // include seller info for product cards (6.2)
  // keep backward-compat: p.owner_user_id remains, but also expose seller_* fields
  let sql = `
    SELECT
      p.*,
      p.owner_user_id AS seller_id,
      COALESCE(u.nickname,'') AS seller_nickname,
      COALESCE(u.name,'') AS seller_name
    FROM products p
    LEFT JOIN users u ON u.id = p.owner_user_id
  `;

  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }

  if (sort === "price") {
    sql += ` ORDER BY p.price ${dir}`;
  } else {
    sql += ` ORDER BY p.id DESC`;
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "db_error" });

    const userId = null;
    withProductStats(rows, userId, (out) => res.json(out));
  });
});

// --- FIX: normalize product tile_slug (run once) ---
app.post("/api/admin/fix-tile-slugs", authRequired, adminRequired, (req, res) => {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1) normalize to lower
    db.run(
      `UPDATE products
       SET tile_slug = LOWER(TRIM(COALESCE(tile_slug,'')))`,
      [],
      (e1) => {
        if (e1) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "db_error", step: "lower", details: String(e1.message || e1) });
        }

        // 2) map title -> slug
        db.run(
          `UPDATE products
           SET tile_slug = (
             SELECT c.slug
             FROM categories c
             WHERE LOWER(TRIM(c.title)) = LOWER(TRIM(products.tile_slug))
             LIMIT 1
           )
           WHERE tile_slug <> ''
             AND EXISTS (
               SELECT 1
               FROM categories c
               WHERE LOWER(TRIM(c.title)) = LOWER(TRIM(products.tile_slug))
             )`,
          [],
          (e2) => {
            if (e2) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: "db_error", step: "map", details: String(e2.message || e2) });
            }

            db.run("COMMIT", (e3) => {
              if (e3) return res.status(500).json({ error: "db_error", step: "commit" });
              res.json({ ok: true });
            });
          }
        );
      }
    );
  });
});

// ===== SEARCH SUGGESTIONS (LIKE-based, stable) =====
app.get("/api/search/suggest", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ products: [], categories: [] });

  db.all(
    `SELECT id, title, category
     FROM products
     WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
     ORDER BY id DESC
     LIMIT 5`,
    [`%${q}%`, `%${q}%`, `%${q}%`],
    (err, productRows) => {
      if (err) return res.status(500).json({ error: "db_error" });

      db.all(
        `SELECT DISTINCT group_name
         FROM categories
         WHERE is_active = 1 AND group_name LIKE ?
         LIMIT 5`,
        [`%${q}%`],
        (err2, catRows) => {
          if (err2) return res.status(500).json({ error: "db_error" });

          res.json({
            products: productRows || [],
            categories: (catRows || []).map(r => r.group_name)
          });
        }
      );
    }
  );
});

app.get("/api/products/:id", (req, res) => {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;

  const id = Number(req.params.id);
  db.get(`SELECT * FROM products WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: "db_error" });
    if (!row) return res.status(404).json({ error: "not_found" });

    if (!token){
      return withProductStats(row, null, (out) => res.json(out[0]));
    }

    db.get(`SELECT user_id, expires_at FROM sessions WHERE token = ?`, [token], (e2, s) => {
      if (e2 || !s) return withProductStats(row, null, (out) => res.json(out[0]));
      const exp = new Date(s.expires_at).getTime();
      if (!Number.isFinite(exp) || exp < Date.now()) return withProductStats(row, null, (out) => res.json(out[0]));
      withProductStats(row, s.user_id, (out) => res.json(out[0]));
    });
  });
});


// =====================
// Seller shops (public)
// =====================

// Seller public profile + simple stats
app.get("/api/sellers/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });

  db.get(
    "SELECT id, name, COALESCE(nickname,'') AS nickname, COALESCE(avatar_url,'') AS avatar_url FROM users WHERE id=?",
    [id],
    (err, seller) => {
      if (err) return res.status(500).json({ error: "db_error" });
      if (!seller) return res.status(404).json({ error: "not_found" });

      db.get("SELECT COUNT(*) AS products_count FROM products WHERE owner_user_id=?", [id], (e2, row1) => {
        if (e2) return res.status(500).json({ error: "db_error" });

        db.get(
          "SELECT COUNT(*) AS likes_count FROM product_likes pl JOIN products p ON p.id = pl.product_id WHERE p.owner_user_id=?",
          [id],
          (e3, row2) => {
            if (e3) return res.status(500).json({ error: "db_error" });

            res.json({
              seller,
              stats: {
                products_count: Number(row1?.products_count || 0),
                likes_count: Number(row2?.likes_count || 0),
              },
            });
          }
        );
      });
    }
  );
});

// Seller products
app.get("/api/sellers/:id/products", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "bad_id" });

  db.all(
    "SELECT * FROM products WHERE owner_user_id=? ORDER BY id DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows || []);
    }
  );
});

// ---------- SELLER FOLLOW (6.3) ----------
// Check if current user follows seller
app.get("/api/sellers/:id/following", authRequired, (req, res) => {
  const sellerId = Number(req.params.id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) return res.status(400).json({ error: "bad_id" });

  db.get(
    `SELECT 1 AS ok FROM seller_follows WHERE follower_user_id=? AND seller_user_id=?`,
    [req.user.id, sellerId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json({ following: !!row });
    }
  );
});

// Follow seller
app.post("/api/sellers/:id/follow", authRequired, (req, res) => {
  const sellerId = Number(req.params.id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) return res.status(400).json({ error: "bad_id" });
  if (sellerId === req.user.id) return res.status(400).json({ error: "self_follow" });

  // ON CONFLICT prevents duplicates
  pool.query(
    `INSERT INTO seller_follows (follower_user_id, seller_user_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_user_id, seller_user_id) DO NOTHING`,
    [req.user.id, sellerId]
  )
    .then(() => res.json({ ok: true }))
    .catch(() => res.status(500).json({ error: "db_error" }));
});

// Unfollow seller
app.delete("/api/sellers/:id/follow", authRequired, (req, res) => {
  const sellerId = Number(req.params.id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) return res.status(400).json({ error: "bad_id" });
  db.run(
    `DELETE FROM seller_follows WHERE follower_user_id=? AND seller_user_id=?`,
    [req.user.id, sellerId],
    function (err) {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json({ ok: true, removed: this.changes || 0 });
    }
  );
});

// ---------- NOTIFICATIONS ----------
app.get("/api/notifications", authRequired, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT id, title, body, link, is_read, created_at
     FROM notifications
     WHERE user_id=?
     ORDER BY id DESC
     LIMIT 50`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      const unread = rows.filter(r => !r.is_read).length;
      res.json({ unread_count: unread, items: rows });
    }
  );
});

app.post("/api/notifications/read", authRequired, (req, res) => {
  const userId = req.user.id;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(n => Number(n)).filter(n => Number.isFinite(n) && n>0) : [];
  if (!ids.length) return res.json({ updated: 0 });
  const placeholders = ids.map((_,i) => `$${i+2}`).join(",");
  pool.query(
    `UPDATE notifications SET is_read=TRUE
     WHERE user_id=$1 AND id IN (${placeholders})`,
    [userId, ...ids]
  )
    .then(r => res.json({ updated: r.rowCount || 0 }))
    .catch(() => res.status(500).json({ error: "db_error" }));
});

app.post("/api/notifications/clear", authRequired, (req, res) => {
  const userId = req.user.id;
  db.run(
    `DELETE FROM notifications WHERE user_id=? AND is_read=TRUE`,
    [userId],
    function(err){
      if (err) return res.status(500).json({ error: "db_error" });
      res.json({ deleted: this.changes || 0 });
    }
  );
});


// admin create/update/delete
app.post("/api/products", authRequired, adminRequired, (req, res) => {
  const { title, description, category, price, stock, image_url } = req.body;
  const tile_slug = String(req.body.tile_slug || "").trim().toLowerCase();

  if (!title || !description || !category) return res.status(400).json({ error: "missing_fields" });
  const p = Number(price);
  const s = Number(stock ?? 10);
  if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ error: "bad_price" });
  if (!Number.isFinite(s) || s < 0) return res.status(400).json({ error: "bad_stock" });

db.run(
  `
  INSERT INTO products (title, description, price, stock, category, image_url, tile_slug, owner_user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [title, description, price, stock, category, image_url, tile_slug, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: "db_error" });
      const newId = this.lastID;

      // notify followers about new product (app-level, no DB triggers)
      try {
        const sellerDisplay = (req.user.nickname && String(req.user.nickname).trim()) ? String(req.user.nickname).trim() : String(req.user.name||"Продавец");
        const nTitle = `Новый товар у продавца ${sellerDisplay}`;
        const nBody = String(title || "");
        const nLink = `product.html?id=${newId}`;
        pool.query(
          `INSERT INTO notifications (user_id, title, body, link)
           SELECT follower_user_id, $2, $3, $4
           FROM seller_follows
           WHERE seller_user_id = $1`,
          [req.user.id, nTitle, nBody, nLink]
        ).catch(()=>{});
      } catch {}

      res.json({ id: newId });
    }
  );
});

app.patch("/api/products/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);

  const fields = [];
  const params = [];

  if (req.body.title !== undefined) { fields.push("title=?"); params.push(String(req.body.title||"").trim()); }
  if (req.body.description !== undefined) { fields.push("description=?"); params.push(String(req.body.description||"").trim()); }
  if (req.body.category !== undefined) { fields.push("category=?"); params.push(String(req.body.category||"").trim()); }
  if (req.body.price !== undefined) { fields.push("price=?"); params.push(Math.round(Number(req.body.price))); }
  if (req.body.stock !== undefined) { fields.push("stock=?"); params.push(Math.round(Number(req.body.stock))); }
  if (req.body.image_url !== undefined) { fields.push("image_url=?"); params.push(String(req.body.image_url||"").trim()); }
 if (req.body.tile_slug !== undefined) {
  fields.push("tile_slug=?");
  params.push(String(req.body.tile_slug||"").trim().toLowerCase());
}
  if (req.body.section !== undefined) { fields.push("section=?"); params.push(String(req.body.section||"Игры").trim()); }

  if (!fields.length) return res.status(400).json({ error: "no_fields" });

  params.push(id);
  db.run(`UPDATE products SET ${fields.join(", ")} WHERE id=?`, params, function(err){
    if (err) return res.status(500).json({ error:"db_error" });
    res.json({ updated: this.changes });
  });
});



app.post("/api/admin/categories", authRequired, adminRequired, (req, res) => {
  const section = String(req.body.section || "Игры").trim();
  const title = String(req.body.title || "").trim();
  const slug = String(req.body.slug || "").trim();
  const icon_url = String(req.body.icon_url || "").trim();
  const emoji = String(req.body.emoji || "").trim(); // необязательно
  const sort_order = Math.round(Number(req.body.sort_order ?? 0) || 0);
  const is_active = (req.body.is_active === undefined) ? 1 : (req.body.is_active ? 1 : 0);

  if (!section || !title || !slug) return res.status(400).json({ error: "missing_fields" });

  db.run(
    `INSERT INTO categories (group_name, section, title, slug, icon_url, emoji, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [section, section, title, slug, icon_url, emoji, sort_order, is_active],
    function(err){
      if (err){
        if (String(err.message||"").includes("UNIQUE")) return res.status(409).json({ error: "slug_taken" });
        return res.status(500).json({ error: "db_error" });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.get("/api/admin/categories", authRequired, adminRequired, (req, res) => {
  db.all(
    `SELECT id, section, title, slug, icon_url, emoji, sort_order, is_active
     FROM categories
     ORDER BY section ASC, sort_order ASC, id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows);
    }
  );
});


app.get("/api/admin/categories/check-slug", authRequired, adminRequired, (req, res) => {
  const slug = String(req.query.slug || "").trim();
  const excludeId = Number(req.query.exclude_id || 0);

  if (!slug) return res.status(400).json({ ok:false, error:"missing_slug" });

  db.get(
    `SELECT id FROM categories WHERE slug=? AND id<>? LIMIT 1`,
    [slug, excludeId || -1],
    (err, row) => {
      if (err) return res.status(500).json({ ok:false, error:"db_error" });
      res.json({ ok:true, available: !row });
    }
  );
});

app.get("/api/categories", (req, res) => {
  db.all(
    `SELECT id, section, title, slug, icon_url, emoji, sort_order
     FROM categories
     WHERE is_active = 1
     ORDER BY section ASC, sort_order ASC, id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows);
    }
  );
});

app.patch("/api/admin/categories/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);

  const fields = [];
  const params = [];

  // allow updating section and icon_url; keep group_name in sync for legacy queries
  if (req.body.section !== undefined) {
    const sec = String(req.body.section||"").trim();
    fields.push("section=?"); params.push(sec);
    if (req.body.group_name === undefined) { fields.push("group_name=?"); params.push(sec); }
  }
  if (req.body.icon_url !== undefined) { fields.push("icon_url=?"); params.push(String(req.body.icon_url||"").trim()); }


  if (req.body.group_name !== undefined) { fields.push("group_name=?"); params.push(String(req.body.group_name||"").trim()); }
  if (req.body.title !== undefined) { fields.push("title=?"); params.push(String(req.body.title||"").trim()); }
  if (req.body.slug !== undefined) { fields.push("slug=?"); params.push(String(req.body.slug||"").trim()); }
  if (req.body.emoji !== undefined) { fields.push("emoji=?"); params.push(String(req.body.emoji||"🎮").trim() || "🎮"); }
  if (req.body.sort_order !== undefined) { fields.push("sort_order=?"); params.push(Math.round(Number(req.body.sort_order)||0)); }
  if (req.body.is_active !== undefined) { fields.push("is_active=?"); params.push(req.body.is_active ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ error: "no_fields" });

  params.push(id);
  db.run(`UPDATE categories SET ${fields.join(", ")} WHERE id=?`, params, function (err) {
    if (err) {
      if (String(err.message||"").includes("UNIQUE")) return res.status(409).json({ error: "slug_taken" });
      return res.status(500).json({ error: "db_error" });
    }
    res.json({ updated: this.changes });
  });
});

// ---------- CATEGORY GROUPS (for chips/menu) ----------
app.get("/api/category-groups", (req, res) => {
  db.all(
    `SELECT group_name, COUNT(*) as tiles_count
     FROM categories
     WHERE is_active = 1
     GROUP BY group_name
     ORDER BY group_name ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      res.json(rows);
    }
  );
});



app.post("/api/admin/categories/reorder", authRequired, adminRequired, async (req, res) => {
  const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
  if (!orders.length) return res.status(400).json({ error: "missing_orders" });

  const clean = [];
  for (const o of orders) {
    const id = Number(o.id);
    const sort_order = Math.round(Number(o.sort_order));
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(sort_order)) continue;
    clean.push({ id, sort_order });
  }
  if (!clean.length) return res.status(400).json({ error: "bad_orders" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const o of clean) {
      await client.query("UPDATE categories SET sort_order=$1 WHERE id=$2", [o.sort_order, o.id]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, updated: clean.length });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("REORDER ERROR:", String(e?.message || e));
    res.status(500).json({ error: "db_error" });
  } finally {
    client.release();
  }
});


app.delete("/api/admin/categories/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  db.run(`DELETE FROM categories WHERE id=?`, [id], function (err) {
    if (err) return res.status(500).json({ error: "db_error" });
    res.json({ deleted: this.changes });
  });
});

app.delete("/api/products/:id", authRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  db.run(`DELETE FROM products WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: "db_error" });
    res.json({ deleted: this.changes });
  });
});

// ---------- LIKES ----------
app.post("/api/products/:id/like", authRequired, (req, res) => {
  const productId = Number(req.params.id);
  const userId = req.user.id;

  db.get(`SELECT 1 FROM product_likes WHERE user_id=? AND product_id=?`, [userId, productId], (err, row) => {
    if (err) return res.status(500).json({ error:"db_error" });

    if (row){
      db.run(`DELETE FROM product_likes WHERE user_id=? AND product_id=?`, [userId, productId], (e2) => {
        if (e2) return res.status(500).json({ error:"db_error" });
        db.get(`SELECT COUNT(*) as c FROM product_likes WHERE product_id=?`, [productId], (_e3, r) => {
          res.json({ liked:false, likes: Number(r?.c||0) });
        });
      });
    } else {
      db.run(`INSERT INTO product_likes (user_id, product_id) VALUES (?,?)`, [userId, productId], (e2) => {
        if (e2) return res.status(500).json({ error:"db_error" });
        db.get(`SELECT COUNT(*) as c FROM product_likes WHERE product_id=?`, [productId], (_e3, r) => {
          res.json({ liked:true, likes: Number(r?.c||0) });
        });
      });
    }
  });
});

// ---------- FAVORITES (liked products list) ----------
app.get("/api/favorites", authRequired, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT p.*
     FROM products p
     JOIN product_likes l ON l.product_id = p.id
     WHERE l.user_id = ?
     ORDER BY p.id DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "db_error" });
      withProductStats(rows, userId, (out) => res.json(out));
    }
  );
});

// ---------- RATING ----------
app.post("/api/products/:id/rate", authRequired, (req, res) => {
  const productId = Number(req.params.id);
  const userId = req.user.id;
  const rating = Math.round(Number(req.body.rating));

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error:"bad_rating" });

  db.run(
    `INSERT INTO product_ratings (user_id, product_id, rating, updated_at)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT(user_id, product_id)
     DO UPDATE SET rating=excluded.rating, updated_at=NOW()`,
    [userId, productId, rating],
    (err) => {
      if (err) return res.status(500).json({ error:"db_error" });
      db.get(
        `SELECT ROUND(AVG(rating),2) as avg, COUNT(*) as cnt
         FROM product_ratings WHERE product_id=?`,
        [productId],
        (_e2, r) => {
          res.json({ my_rating: rating, rating_avg: Number(r?.avg||0), rating_count: Number(r?.cnt||0) });
        }
      );
    }
  );
});

// ---------- ORDERS ----------
app.post("/api/orders", authRequired, async (req, res) => {
  const userId = req.user.id;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const delivery = req.body.delivery || {};
  const comment = String(req.body.comment || "");

  if (items.length === 0) return res.status(400).json({ error: "empty_items" });

  const productIds = items.map(x => Number(x.product_id)).filter(Number.isFinite);
  if (productIds.length === 0) return res.status(400).json({ error: "bad_items" });

  try {
    // load products
    const placeholders = productIds.map((_, i) => `$${i+1}`).join(",");
    const rProds = await pool.query(
      `SELECT id, title, price, stock FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const rows = rProds.rows || [];
    const map = new Map(rows.map(r => [Number(r.id), r]));

    let subtotal = 0;
    const normalized = [];

    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Math.max(1, Math.min(999, Number(it.qty) || 1));
      const p = map.get(pid);
      if (!p) return res.status(400).json({ error: "product_not_found", product_id: pid });
      if (Number(p.stock) < qty) return res.status(400).json({ error: "not_enough_stock", product_id: pid });

      subtotal += Number(p.price) * qty;
      normalized.push({ product_id: pid, title: p.title, price: Number(p.price), qty });
    }

    const deliveryPrice = Number(delivery.price || 0) || 0;
    const total = subtotal + deliveryPrice;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const rOrder = await client.query(
        `INSERT INTO orders
         (user_id, status, subtotal, delivery_price, total, delivery_method, delivery_city, delivery_address, phone, comment)
         VALUES ($1, 'created', $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          userId,
          Math.round(subtotal),
          Math.round(deliveryPrice),
          Math.round(total),
          String(delivery.method || ""),
          String(delivery.city || ""),
          String(delivery.address || ""),
          String(delivery.phone || ""),
          comment
        ]
      );

      const orderId = rOrder.rows[0].id;

      for (const it of normalized) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, title, price, qty)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, it.product_id, it.title, it.price, it.qty]
        );
      }

      for (const it of normalized) {
        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2`,
          [it.qty, it.product_id]
        );
      }

      await client.query("COMMIT");
      res.json({ id: orderId });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("ORDER TX ERROR:", String(e?.message || e));
      res.status(500).json({ error: "db_error" });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("ORDER ERROR:", String(e?.message || e));
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/api/orders/my", authRequired, (req, res) => {
  db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: "db_error" });
    res.json(rows);
  });
});

app.get("/api/orders/:id", authRequired, (req, res) => {
  const orderId = Number(req.params.id);
  db.get(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, [orderId, req.user.id], (err, order) => {
    if (err) return res.status(500).json({ error: "db_error" });
    if (!order) return res.status(404).json({ error: "not_found" });

    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [orderId], (err2, items) => {
      if (err2) return res.status(500).json({ error: "db_error" });
      res.json({ order, items });
    });
  });
});

app.get("/api/tiles/:slug/products", (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();

  db.get(
    `SELECT title FROM categories WHERE LOWER(slug)=? LIMIT 1`,
    [slug],
    (e, cat) => {
      const title = String(cat?.title || "").trim().toLowerCase();

      db.all(
        `
        SELECT
          p.*,
          p.owner_user_id AS seller_id,
          COALESCE(u.nickname,'') AS seller_nickname,
          COALESCE(u.name,'') AS seller_name
        FROM products p
        LEFT JOIN users u ON u.id = p.owner_user_id
        WHERE LOWER(COALESCE(tile_slug,'')) = ?
           OR LOWER(COALESCE(tile_slug,'')) = ?
        ORDER BY id DESC
        `,
        [slug, title],
        (err, rows) => {
          if (err) return res.status(500).json({ error: "db_error" });
          res.json(rows || []);
        }
      );
    }
  );
});

// ---------- START ----------
const PORT = process.env.PORT || 3000;

// ---------- error handler (multer etc.) ----------
app.use((err, _req, res, _next) => {
  if (!err) return res.status(500).json({ error: "unknown" });
  if (err.message === "bad_file_type") return res.status(400).json({ error: "bad_file_type" });
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "file_too_large" });
  return res.status(500).json({ error: "server_error" });
});

(async () => {
  try {
    await init(); // <-- важно дождаться создания таблиц
    app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
  } catch (e) {
    console.error("INIT FAILED:", e?.message || e);
    process.exit(1);
  }
})();
