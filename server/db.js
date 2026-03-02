// server/db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  get(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows[0] || null))
      .catch(e => cb(e));
  },
  all(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows || []))
      .catch(e => cb(e));
  },
  run(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => {
        if (typeof cb === "function") cb.call({ changes: r.rowCount }, null);
      })
      .catch(e => {
        if (typeof cb === "function") cb(e);
      });
  },
  exec(sql, cb) {
    pool.query(sql)
      .then(() => cb && cb(null))
      .catch(e => cb && cb(e));
  },
  serialize(fn) { fn(); },
};

async function init() {
  // 1) Таблицы (если их вообще нет)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price INT NOT NULL
    );
  `);


  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';`);


  // 2) “Догоняем” колонки, если таблицы уже были созданы раньше в другом виде
  // users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';`);

// users — догоняем базовые колонки для auth
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pass_salt TEXT DEFAULT '';`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pass_hash TEXT DEFAULT '';`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;`);


// уникальность email (если ещё нет)
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (email);`);


  // products
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0;`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tile_slug TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS section TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id);`);

  // optional tables for likes/ratings/follows (твой код их дергает, ошибки там глушатся, но лучше создать)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_likes (
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, product_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_ratings (
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      rating INT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (follower_user_id, seller_user_id)
    );
  `);
}


module.exports = { db, init, pool };