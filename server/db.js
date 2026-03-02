// server/db.js (PostgreSQL)
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      group_name TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🎮',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      tile_slug TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT 'Игры'
    );

    CREATE TABLE IF NOT EXISTS product_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS product_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_price INTEGER NOT NULL,
      total INTEGER NOT NULL,
      delivery_method TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      phone TEXT NOT NULL,
      comment TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL
    );
  `);

  // ---- Seller shops / profile fields migrations ----
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';`);

  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON products(owner_user_id);`);

  // ---- Seller follows (no DB triggers; app-level notifications) ----
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL DEFAULT (NOW()::text),
      PRIMARY KEY (follower_user_id, seller_user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON seller_follows(follower_user_id);`);

  // ---- Notifications ----
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);`);
}

// convert "?" placeholders -> $1, $2, ...
function qmarkToDollar(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  get(sql, params, cb) {
    pool.query(qmarkToDollar(sql), params || [])
      .then(r => cb(null, r.rows[0] || undefined))
      .catch(e => cb(e));
  },
  all(sql, params, cb) {
    pool.query(qmarkToDollar(sql), params || [])
      .then(r => cb(null, r.rows || []))
      .catch(e => cb(e));
  },
run(sql, params, cb) {
  // convert "?" -> $1, $2...
  const qmarkToDollar = (s) => {
    let i = 0;
    return s.replace(/\?/g, () => `$${++i}`);
  };

  // Добавляем "RETURNING id" только для таблиц где есть id
  const addReturningIdIfNeeded = (s) => {
    const t = String(s).trim();
    const m = t.match(/^insert\s+into\s+([a-z0-9_]+)/i);
    if (!m) return s;

    const table = m[1].toLowerCase();
    const tablesWithId = new Set(["users", "categories", "products", "orders", "order_items"]);

    if (!tablesWithId.has(table)) return s;
    if (/returning\s+/i.test(t)) return s;

    return t.replace(/;?\s*$/, "") + " RETURNING id";
  };

  const finalSql = qmarkToDollar(addReturningIdIfNeeded(sql));

  pool.query(finalSql, params || [])
    .then(r => {
      const ctx = {
        changes: r.rowCount || 0,
        lastID: r.rows?.[0]?.id
      };
      cb && cb.call(ctx, null);
    })
    .catch(e => cb && cb(e));
},
};

module.exports = { db, init, pool };