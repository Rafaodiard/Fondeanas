// Guardado de las cuentas en Postgres (para hosting sin disco fijo, como Render gratis + Neon).
// Se usa cuando existe la variable DATABASE_URL; si no, las cuentas van a datos/cuentas.json (servidor/cuentas.js).
// Guarda el mismo documento JSON que el archivo, en una sola fila de la tabla sf_datos (clave 'cuentas'). Alcanza
// para cientos de cuentas y es igual de simple que el archivo. Las escrituras van de a una y en orden.
export async function almacenPostgres(url, log = console) {
  const { default: pg } = await import('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  // Neon y los Postgres en la nube piden SSL con certificado válido; si la URL ya dice sslmode, se respeta eso
  const ssl = /sslmode=/.test(url) || local ? undefined : { rejectUnauthorized: true };
  const pool = new pg.Pool({ connectionString: url, ssl, max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
  pool.on('error', (e) => log.warn(`⚠ Postgres: ${e.message}`));
  await pool.query(`CREATE TABLE IF NOT EXISTS sf_datos (
    clave text PRIMARY KEY,
    valor jsonb NOT NULL,
    actualizado timestamptz NOT NULL DEFAULT now()
  )`);
  return {
    nombre: 'Postgres',
    async cargar() {
      const r = await pool.query("SELECT valor FROM sf_datos WHERE clave = 'cuentas'");
      return r.rows[0]?.valor || null;
    },
    async guardar(json) {
      await pool.query(
        `INSERT INTO sf_datos (clave, valor, actualizado) VALUES ('cuentas', $1::jsonb, now())
         ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now()`, [json]);
    },
    cerrar: () => pool.end(),
  };
}
