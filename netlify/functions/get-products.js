const { neon } = require("@netlify/neon");

exports.handler = async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT id, title, price, created_at FROM products ORDER BY id DESC`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};