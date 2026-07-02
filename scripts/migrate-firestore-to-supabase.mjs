#!/usr/bin/env node
/**
 * Migración one-shot: Firestore -> Supabase (Postgres + Auth + Storage).
 *
 * No es parte del bundle de la app (no se importa desde src/). Requiere:
 *   - FIREBASE_SERVICE_ACCOUNT_PATH: ruta a un JSON de service account de Firebase
 *   - FIREBASE_STORAGE_BUCKET: nombre del bucket de Firebase Storage (solo Fase D)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: del proyecto Supabase destino
 *
 * Uso:
 *   node scripts/migrate-firestore-to-supabase.mjs --dry-run   (default, no escribe nada)
 *   node scripts/migrate-firestore-to-supabase.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carga .env.local (si existe) sin depender del shell del usuario (bash/fish/etc varían en sintaxis de export).
const envLocalPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}
const APPLY = process.argv.includes("--apply");
const TEMP_PASSWORD = "emp123";
const VALID_ROLES = new Set(["admin", "rh", "psicologa", "empleado"]);
const VALID_ESTADO_SOLICITUD = new Set(["pendiente", "aprobado", "rechazado"]);
const VALID_ESTADO_DESCUENTO = new Set(["pendiente", "activo", "pagado", "cancelado"]);
const VALID_ESTADO_REPORTE = new Set(["nuevo", "revisado", "cerrado"]);
const VALID_TIPO_PREGUNTA = new Set(["escala", "sino", "opcion", "abierta"]);

const report = {
  startedAt: new Date().toISOString(),
  dryRun: !APPLY,
  usuarios: { total: 0, creados: 0, colisiones: [] },
  encuestaPreguntas: { total: 0, fuente: null },
  colecciones: {},
  huerfanos: {},
  advertencias: [],
};

// Debe coincidir con src/config/supabase.js y las Edge Functions.
const usernameToSyntheticEmail = (username) => {
  const saneado = (username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  return `${saneado}@mcdental.internal`;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ── Setup clientes ──────────────────────────────────────────────────────

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  console.error("Falta FIREBASE_SERVICE_ACCOUNT_PATH (ruta al JSON de service account de Firebase).");
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
});
const firestore = getFirestore(firebaseApp);
const firebaseStorage = getStorage(firebaseApp);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getAllDocs = async (collectionName) => {
  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ firebaseId: doc.id, ...doc.data() }));
};

// ── Fallback estático de preguntas (igual al que usa el frontend si Firestore está vacío) ──
const ENCUESTA_PREGUNTAS_FALLBACK = [
  { id: 1, texto: "¿Cómo describes tu estado emocional esta semana?", tipo: "escala", area: "Emocional" },
  { id: 2, texto: "¿Qué tan estresado/a te has sentido en el trabajo?", tipo: "escala", area: "Estrés" },
  { id: 3, texto: "¿Qué tan satisfecho/a estás con tu trabajo actualmente?", tipo: "escala", area: "Satisfacción" },
  { id: 4, texto: "¿Cómo es tu relación con tus compañeros esta semana?", tipo: "escala", area: "Relaciones" },
  { id: 5, texto: "¿Cómo es tu relación con tu jefe directo?", tipo: "escala", area: "Liderazgo" },
  { id: 6, texto: "¿Sientes que tu carga de trabajo es manejable?", tipo: "sino", area: "Carga" },
  { id: 7, texto: "¿Tienes algún problema personal que esté afectando tu trabajo?", tipo: "sino", area: "Personal" },
  { id: 8, texto: "¿Qué tan motivado/a te sientes para venir a trabajar?", tipo: "escala", area: "Motivación" },
  { id: 9, texto: "¿Has pensado en renunciar durante esta semana?", tipo: "opcion", opciones: ["No", "Algo", "Sí, seriamente"], area: "Riesgo" },
  { id: 10, texto: "¿Quieres compartir algo más con el equipo de bienestar?", tipo: "abierta", area: "Comentarios" },
];

// ── FASE A: usuarios + auth ─────────────────────────────────────────────

const faseAUsuarios = async () => {
  console.log("\n=== FASE A: usuarios + auth ===");
  const usuariosFirestore = await getAllDocs("usuarios");
  const usuariosPasswordFirestore = await getAllDocs("usuariosPassword");
  const passwordByUserId = new Map(usuariosPasswordFirestore.map((u) => [u.userId, u]));

  report.usuarios.total = usuariosFirestore.length;

  // 1) Sanear + detectar colisiones ANTES de escribir nada.
  const emailToUsers = new Map();
  const preparados = usuariosFirestore.map((u) => {
    const username = u.user || "";
    const email = usernameToSyntheticEmail(username);
    if (!emailToUsers.has(email)) emailToUsers.set(email, []);
    emailToUsers.get(email).push(u);
    const role = VALID_ROLES.has(u.role) ? u.role : "empleado";
    if (!VALID_ROLES.has(u.role)) {
      report.advertencias.push(`usuario legacy_id=${u.id} tiene role inválido "${u.role}", se asigna "empleado".`);
    }
    return { legacyId: u.id, name: u.name, username, email, role, sucursal: u.sucursal, puesto: u.puesto, telefono: u.telefono, emailReal: u.email, fechaIngreso: u.fechaIngreso || null, fechaCumpleanos: u.fechaCumpleanos || null, fechaNacimiento: u.fechaNacimiento || null };
  });

  for (const [email, users] of emailToUsers.entries()) {
    if (users.length > 1) {
      report.usuarios.colisiones.push({ email, legacyIds: users.map((u) => u.id) });
    }
  }

  if (report.usuarios.colisiones.length > 0) {
    console.error(`\nColisiones de username saneado detectadas (${report.usuarios.colisiones.length}). Abortando.`);
    console.error(JSON.stringify(report.usuarios.colisiones, null, 2));
    writeReport();
    process.exit(1);
  }

  console.log(`${preparados.length} usuarios listos para migrar (sin colisiones).`);

  const legacyIdToNewId = new Map();
  const nombreToNewId = new Map(); // fallback para resolver responsable/otorgadoPor guardados solo como nombre

  if (!APPLY) {
    for (const p of preparados) {
      console.log(`  [dry-run] crearía: ${p.username} -> ${p.email} (role=${p.role})`);
      // Placeholder (no es un uuid real) solo para que la Fase C pueda simular
      // la resolución de referencias y reportar huérfanos reales, no falsos
      // positivos por mapas vacíos.
      legacyIdToNewId.set(p.legacyId, `dry-run:${p.legacyId}`);
      if (p.name) nombreToNewId.set(p.name, `dry-run:${p.legacyId}`);
    }
    return { legacyIdToNewId, nombreToNewId };
  }

  for (const p of preparados) {
    const { data: createdAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: p.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });

    if (authError || !createdAuthUser?.user) {
      report.advertencias.push(`No se pudo crear auth.users para ${p.username}: ${authError?.message}`);
      continue;
    }

    const { data: usuarioRow, error: insertError } = await supabase
      .from("usuarios")
      .insert({
        auth_user_id: createdAuthUser.user.id,
        legacy_id: p.legacyId,
        name: p.name,
        username: p.username,
        synthetic_email: p.email,
        role: p.role,
        sucursal: p.sucursal,
        puesto: p.puesto,
        telefono: p.telefono,
        email: p.emailReal,
        fecha_ingreso: p.fechaIngreso || null,
        fecha_cumpleanos: p.fechaCumpleanos || null,
        fecha_nacimiento: p.fechaNacimiento || null,
        debe_cambiar_password: true,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: no dejar huérfano en auth.users.
      await supabase.auth.admin.deleteUser(createdAuthUser.user.id);
      report.advertencias.push(`No se pudo insertar usuarios para ${p.username}: ${insertError.message}`);
      continue;
    }

    legacyIdToNewId.set(p.legacyId, usuarioRow.id);
    if (p.name) nombreToNewId.set(p.name, usuarioRow.id);
    report.usuarios.creados += 1;
    console.log(`  ✓ ${p.username} -> ${usuarioRow.id}`);
  }

  // Referencia informativa: las contraseñas viejas (texto plano) nunca se migran.
  console.log(`${passwordByUserId.size} registros de usuariosPassword leídos (descartados, ver nota de seguridad).`);

  return { legacyIdToNewId, nombreToNewId };
};

// ── FASE B: encuesta_preguntas ──────────────────────────────────────────

const faseBPreguntas = async () => {
  console.log("\n=== FASE B: encuesta_preguntas ===");
  let preguntasFirestore = await getAllDocs("encuesta_preguntas");
  let fuente = "firestore";
  if (preguntasFirestore.length === 0) {
    preguntasFirestore = ENCUESTA_PREGUNTAS_FALLBACK.map((p) => ({ ...p, firebaseId: null }));
    fuente = "fallback estático (src/data/initialData.js)";
  }
  report.encuestaPreguntas.total = preguntasFirestore.length;
  report.encuestaPreguntas.fuente = fuente;
  console.log(`${preguntasFirestore.length} preguntas (fuente: ${fuente}).`);

  const preguntaLegacyIdToNewId = new Map();

  if (!APPLY) {
    for (const p of preguntasFirestore) {
      console.log(`  [dry-run] crearía pregunta legacy_id=${p.id}: "${String(p.texto).slice(0, 40)}..."`);
    }
    return preguntaLegacyIdToNewId;
  }

  for (const p of preguntasFirestore) {
    const tipo = VALID_TIPO_PREGUNTA.has(p.tipo) ? p.tipo : "escala";
    const { data, error } = await supabase
      .from("encuesta_preguntas")
      .insert({
        legacy_id: p.id ?? null,
        texto: p.texto,
        tipo,
        area: p.area,
        opciones: tipo === "opcion" ? p.opciones || [] : null,
        orden: p.orden ?? p.id ?? 0,
        activa: p.activa !== false,
      })
      .select()
      .single();

    if (error) {
      report.advertencias.push(`No se pudo insertar pregunta legacy_id=${p.id}: ${error.message}`);
      continue;
    }
    if (p.id != null) preguntaLegacyIdToNewId.set(p.id, data.id);
  }

  return preguntaLegacyIdToNewId;
};

// ── FASE C: resto de colecciones ────────────────────────────────────────

const resolveEmpleado = (legacyId, legacyIdToNewId, collectionName, doc) => {
  const nuevoId = legacyIdToNewId.get(legacyId);
  if (!nuevoId) {
    report.huerfanos[collectionName] ||= [];
    report.huerfanos[collectionName].push({ firebaseId: doc.firebaseId, empleadoIdLegacy: legacyId });
  }
  return nuevoId || null;
};

const insertBatched = async (table, rows, collectionName) => {
  report.colecciones[collectionName] = { total: rows.length, insertados: 0, omitidos: 0 };
  if (!APPLY) {
    console.log(`  [dry-run] ${rows.length} filas listas para ${table}.`);
    return;
  }
  for (const batch of chunk(rows, 500)) {
    const validas = batch.filter((r) => r !== null);
    report.colecciones[collectionName].omitidos += batch.length - validas.length;
    if (validas.length === 0) continue;
    const { error } = await supabase.from(table).insert(validas);
    if (error) {
      report.advertencias.push(`Error insertando batch en ${table}: ${error.message}`);
      continue;
    }
    report.colecciones[collectionName].insertados += validas.length;
  }
  console.log(`  ${table}: ${report.colecciones[collectionName].insertados} insertados, ${report.colecciones[collectionName].omitidos} omitidos (huérfanos).`);
};

const faseCColecciones = async (legacyIdToNewId, preguntaLegacyIdToNewId, nombreToNewId) => {
  console.log("\n=== FASE C: resto de colecciones ===");

  // encuestas
  const encuestasFirestore = await getAllDocs("encuestas");
  const encuestasRows = encuestasFirestore.map((e) => {
    const empleadoId = resolveEmpleado(e.empleadoId, legacyIdToNewId, "encuestas", e);
    if (!empleadoId) return null;
    const respuestasRemapeadas = {};
    for (const [key, value] of Object.entries(e.respuestas || {})) {
      const nuevaKey = preguntaLegacyIdToNewId.get(Number(key)) || preguntaLegacyIdToNewId.get(key) || key;
      respuestasRemapeadas[nuevaKey] = value;
    }
    return {
      empleado_id: empleadoId,
      semana: e.semana,
      respuestas: respuestasRemapeadas,
      score: Number.isFinite(Number(e.score)) ? Math.round(Number(e.score)) : null,
      semaforo: e.semaforo || null,
      fecha: e.fecha || new Date().toISOString().slice(0, 10),
    };
  });
  await insertBatched("encuestas", encuestasRows, "encuestas");

  // mensajes
  const mensajesFirestore = await getAllDocs("mensajes");
  const mensajesRows = mensajesFirestore.map((m) => {
    const deId = resolveEmpleado(m.de, legacyIdToNewId, "mensajes", m);
    const paraId = resolveEmpleado(m.para, legacyIdToNewId, "mensajes", m);
    if (!deId || !paraId) return null;
    return { de_id: deId, para_id: paraId, texto: m.texto, leido: !!m.leido, fecha: m.fecha || new Date().toISOString() };
  });
  await insertBatched("mensajes", mensajesRows, "mensajes");

  // notasPsicologicas
  const notasFirestore = await getAllDocs("notasPsicologicas");
  const notasRows = notasFirestore.map((n) => {
    const empleadoId = resolveEmpleado(n.empleadoId, legacyIdToNewId, "notasPsicologicas", n);
    if (!empleadoId) return null;
    const autorId = legacyIdToNewId.get(n.autorId) || null;
    return { empleado_id: empleadoId, autor_id: autorId, autor_nombre: n.autor, texto: n.texto, fecha: n.fecha || new Date().toISOString().slice(0, 10) };
  });
  await insertBatched("notas_psicologicas", notasRows, "notasPsicologicas");

  // vacaciones
  const vacacionesFirestore = await getAllDocs("vacaciones");
  const vacacionesRows = vacacionesFirestore.map((v) => {
    const empleadoId = resolveEmpleado(v.empleadoId, legacyIdToNewId, "vacaciones", v);
    if (!empleadoId) return null;
    let estado = v.estado;
    if (!VALID_ESTADO_SOLICITUD.has(estado)) {
      report.advertencias.push(`vacaciones firebaseId=${v.firebaseId} estado inválido "${estado}", se usa "pendiente".`);
      estado = "pendiente";
    }
    return {
      empleado_id: empleadoId,
      fecha_inicio: v.fechaInicio || v.inicio || v.desde,
      fecha_fin: v.fechaFin || v.fin || v.hasta,
      dias: v.dias || 1,
      motivo: v.motivo,
      comentario: v.comentario,
      comentario_rh: v.comentarioRH,
      estado,
      origen: v.origen === "rh" ? "rh" : "empleado",
    };
  });
  await insertBatched("vacaciones", vacacionesRows, "vacaciones");

  // permisos
  const permisosFirestore = await getAllDocs("permisos");
  const permisosRows = permisosFirestore.map((p) => {
    const empleadoId = resolveEmpleado(p.empleadoId, legacyIdToNewId, "permisos", p);
    if (!empleadoId) return null;
    let estado = p.estado;
    if (!VALID_ESTADO_SOLICITUD.has(estado)) {
      report.advertencias.push(`permisos firebaseId=${p.firebaseId} estado inválido "${estado}", se usa "pendiente".`);
      estado = "pendiente";
    }
    return {
      empleado_id: empleadoId,
      fecha: p.fecha,
      hora: p.hora || null,
      motivo: p.motivo,
      comentario: p.comentario,
      comentario_rh: p.comentarioRH,
      estado,
      origen: p.origen === "rh" ? "rh" : "empleado",
    };
  });
  await insertBatched("permisos", permisosRows, "permisos");

  // descuentos
  const descuentosFirestore = await getAllDocs("descuentos");
  const descuentosRows = descuentosFirestore.map((d) => {
    const empleadoId = resolveEmpleado(d.empleadoId, legacyIdToNewId, "descuentos", d);
    if (!empleadoId) return null;
    let estado = d.estado;
    if (!VALID_ESTADO_DESCUENTO.has(estado)) {
      report.advertencias.push(`descuentos firebaseId=${d.firebaseId} estado inválido "${estado}", se usa "pendiente".`);
      estado = "pendiente";
    }
    return {
      empleado_id: empleadoId,
      tipo: d.tipo,
      motivo: d.motivo,
      observaciones: d.observaciones,
      monto: d.monto || 0,
      fecha: d.fecha || d.fechaCreacion || new Date().toISOString().slice(0, 10),
      estado,
      responsable_id: nombreToNewId.get(d.responsable || d.autor) || null,
      responsable_nombre: d.responsable || d.autor,
    };
  });
  await insertBatched("descuentos", descuentosRows, "descuentos");

  // reportesConfidenciales
  const reportesFirestore = await getAllDocs("reportesConfidenciales");
  const reportesRows = reportesFirestore.map((r) => {
    const empleadoId = resolveEmpleado(r.empleadoId, legacyIdToNewId, "reportesConfidenciales", r);
    if (!empleadoId) return null;
    let estado = r.estado;
    if (!VALID_ESTADO_REPORTE.has(estado)) estado = "nuevo";
    // visiblePara se descarta: ahora es RLS.
    return {
      empleado_id: empleadoId,
      tipo: r.tipo,
      urgencia: r.urgencia,
      descripcion: r.descripcion,
      evidencias: r.evidencias,
      estado,
      fecha: r.fecha || new Date().toISOString().slice(0, 10),
    };
  });
  await insertBatched("reportes_confidenciales", reportesRows, "reportesConfidenciales");

  // reconocimientos
  const reconocimientosFirestore = await getAllDocs("reconocimientos");
  const reconocimientosRows = reconocimientosFirestore.map((r) => {
    const empleadoId = resolveEmpleado(r.empleadoId, legacyIdToNewId, "reconocimientos", r);
    if (!empleadoId) return null;
    return {
      empleado_id: empleadoId,
      categoria: r.categoria,
      comentario: r.comentario,
      otorgado_por: nombreToNewId.get(r.otorgadoPor) || null,
      otorgado_por_nombre: r.otorgadoPor,
      fecha: r.fecha || new Date().toISOString().slice(0, 10),
    };
  });
  await insertBatched("reconocimientos", reconocimientosRows, "reconocimientos");

  // archivosExpediente (metadata; Fase D sube el binario y corrige ruta_archivo)
  const archivosFirestore = await getAllDocs("archivosExpediente");
  const archivosPreparados = archivosFirestore
    .map((a) => {
      const empleadoId = resolveEmpleado(a.empleadoId, legacyIdToNewId, "archivosExpediente", a);
      if (!empleadoId) return null;
      return {
        firebaseId: a.firebaseId,
        empleadoIdNuevo: empleadoId,
        nombreArchivo: a.nombreArchivo,
        tipoArchivo: a.tipoArchivo,
        rutaArchivoOriginal: a.rutaArchivo,
        fecha: a.fecha || new Date().toISOString().slice(0, 10),
        subidoPorId: nombreToNewId.get(a.subidoPor) || null,
      };
    })
    .filter(Boolean);

  return { archivosPreparados };
};

// ── FASE D: Storage ──────────────────────────────────────────────────────

const faseDStorage = async (archivosPreparados) => {
  console.log("\n=== FASE D: Storage (archivos de expediente) ===");
  report.colecciones.archivosExpediente = { total: archivosPreparados.length, insertados: 0, omitidos: 0 };

  if (!APPLY) {
    console.log(`  [dry-run] ${archivosPreparados.length} archivos listos para re-subir.`);
    return;
  }

  const bucket = firebaseStorage.bucket();
  for (const a of archivosPreparados) {
    try {
      const rutaNueva = `${a.empleadoIdNuevo}/${Date.now()}-${a.nombreArchivo}`;
      const [buffer] = await bucket.file(a.rutaArchivoOriginal).download();

      const { error: uploadError } = await supabase.storage.from("expedientes").upload(rutaNueva, buffer, {
        contentType: undefined,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("archivos_expediente").insert({
        empleado_id: a.empleadoIdNuevo,
        nombre_archivo: a.nombreArchivo,
        tipo_archivo: a.tipoArchivo,
        ruta_archivo: rutaNueva,
        fecha: a.fecha,
        subido_por: a.subidoPorId,
      });
      if (insertError) throw insertError;

      report.colecciones.archivosExpediente.insertados += 1;
      console.log(`  ✓ ${a.nombreArchivo}`);
    } catch (err) {
      report.colecciones.archivosExpediente.omitidos += 1;
      report.advertencias.push(`Archivo faltante o error subiendo "${a.nombreArchivo}" (firebaseId=${a.firebaseId}): ${err.message}`);
      console.warn(`  ⚠ ${a.nombreArchivo}: ${err.message}`);
    }
  }
};

// ── Reporte final ─────────────────────────────────────────────────────

const writeReport = () => {
  report.finishedAt = new Date().toISOString();
  const reportPath = path.join(__dirname, "migration-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReporte escrito en ${reportPath}`);
};

// ── Main ──────────────────────────────────────────────────────────────

const main = async () => {
  console.log(`Migración Firestore -> Supabase (${APPLY ? "APPLY" : "DRY-RUN"})`);

  const { legacyIdToNewId, nombreToNewId } = await faseAUsuarios();
  const preguntaLegacyIdToNewId = await faseBPreguntas();
  const { archivosPreparados } = await faseCColecciones(legacyIdToNewId, preguntaLegacyIdToNewId, nombreToNewId);
  await faseDStorage(archivosPreparados);

  writeReport();

  console.log("\n=== Resumen ===");
  console.log(`Usuarios: ${report.usuarios.creados}/${report.usuarios.total}`);
  for (const [name, stats] of Object.entries(report.colecciones)) {
    console.log(`${name}: ${stats.insertados ?? 0}/${stats.total} (omitidos: ${stats.omitidos ?? 0})`);
  }
  if (report.advertencias.length) {
    console.log(`\n${report.advertencias.length} advertencias — ver migration-report.json.`);
  }
  console.log(APPLY ? "\nMigración aplicada." : "\nDry-run completado. Revisá el reporte y corré con --apply.");
};

main().catch((err) => {
  console.error("Error fatal en la migración:", err);
  writeReport();
  process.exit(1);
});
