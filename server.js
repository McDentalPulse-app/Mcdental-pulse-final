// Wrapper Express para los handlers de api/*.js (mismos que corrían como funciones
// serverless de Vercel). No se reescribe nada de la lógica: cada handler sigue siendo
// `export default async function handler(req, res)`, Express ya expone res.status()/
// .json() nativos, así que basta con montarlos como rutas.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "api");

const app = express();
app.use(express.json({ limit: "5mb" })); // fotos del reto viajan en base64 en el body

const archivos = fs
  .readdirSync(apiDir)
  .filter((f) => f.endsWith(".js") && !f.startsWith("_") && !f.endsWith(".test.js"));

for (const archivo of archivos) {
  const ruta = `/api/${archivo.replace(/\.js$/, "")}`;
  const { default: handler } = await import(path.join(apiDir, archivo));
  app.all(ruta, (req, res) => {
    handler(req, res).catch((err) => {
      console.error(`Error en ${ruta}:`, err);
      if (!res.headersSent) res.status(500).json({ error: "Error interno." });
    });
  });
  console.log(`montado: ${ruta}`);
}

app.get("/health", (_req, res) => res.status(200).send("ok"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`api-server escuchando en :${PORT}`));
