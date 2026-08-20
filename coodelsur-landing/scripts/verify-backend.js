/**
 * Verificación rápida de backend (generate + health).
 * Uso: npm run verify:backend
 */
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  run("npx prisma generate");

  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  console.log(`\nProbando health en ${base}/api/health ...`);

  try {
    const res = await fetch(`${base}/api/health`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    if (!json.database) {
      console.log(
        "\n[aviso] DB no conectada. Configura DATABASE_URL y ejecuta: npm run db:push",
      );
      process.exitCode = 0;
      return;
    }
    console.log("\n[ok] Backend con base de datos respondiendo.");
  } catch (error) {
    console.log(
      "\n[aviso] No se pudo llamar /api/health (¿está corriendo npm run dev?).",
    );
    console.log(String(error));
    process.exitCode = 0;
  }
}

main();
