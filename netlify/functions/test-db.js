const { neon } = require("@netlify/neon");

exports.handler = async () => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT NOW() as now`;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, time: result[0].now }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message }),
    };
  }
};