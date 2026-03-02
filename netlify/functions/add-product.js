const { neon } = require("@netlify/neon");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const title = String(body.title || "").trim();
    const price = Number(body.price);

    if (!title || !Number.isFinite(price)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Нужно передать title и price" }),
      };
    }

    const sql = neon(process.env.DATABASE_URL);
    const inserted = await sql`
      INSERT INTO products (title, price)
      VALUES (${title}, ${price})
      RETURNING id, title, price, created_at
    `;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inserted[0]),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};