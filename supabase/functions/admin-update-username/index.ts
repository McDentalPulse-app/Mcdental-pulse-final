import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { usernameToSyntheticEmail } from "../_shared/username.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cambiar el nombre de usuario requiere service role: el login autentica contra
// auth.users.email (email sintético), así que un update solo en public.usuarios
// deja al empleado sin poder entrar con el username nuevo. Esta función
// actualiza las TRES piezas: auth.users.email, usuarios.username y
// usuarios.synthetic_email. Es idempotente: llamarla con el username actual
// re-sincroniza los emails (útil para reparar desincronizaciones).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuthUser }, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuthUser) {
      return json({ error: "No autenticado." }, 401);
    }

    const { data: callerPerfil, error: callerPerfilError } = await callerClient
      .from("usuarios")
      .select("id, role")
      .eq("auth_user_id", callerAuthUser.id)
      .single();

    if (callerPerfilError || !["admin", "rh"].includes(callerPerfil?.role)) {
      return json({ error: "No tienes permiso para cambiar nombres de usuario." }, 403);
    }

    const { usuarioId, nuevoUsername } = await req.json();
    if (!usuarioId || typeof nuevoUsername !== "string" || !nuevoUsername.trim()) {
      return json({ error: "Faltan 'usuarioId' o 'nuevoUsername'." }, 400);
    }

    const username = nuevoUsername.trim().toLowerCase();
    const nuevoEmail = usernameToSyntheticEmail(username);
    if (nuevoEmail.startsWith("@")) {
      return json({ error: "Nombre de usuario inválido." }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: objetivo, error: objetivoError } = await adminClient
      .from("usuarios")
      .select("id, auth_user_id, synthetic_email, role")
      .eq("id", usuarioId)
      .single();

    if (objetivoError || !objetivo?.auth_user_id) {
      return json({ error: "Usuario no encontrado." }, 404);
    }

    // Esta función reescribe auth.users.email, que es la credencial real de login: sin esta
    // guarda un 'rh' podía cambiar el username de un 'admin' y dejarlo sin poder entrar.
    if (callerPerfil.role !== "admin" && objetivo.role === "admin") {
      return json({ error: "Solo un administrador puede cambiar el nombre de usuario de otro administrador." }, 403);
    }

    // Disponibilidad: nadie más puede tener ese email sintético.
    const { data: ocupado } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("synthetic_email", nuevoEmail)
      .neq("id", usuarioId)
      .maybeSingle();
    if (ocupado) {
      return json({ error: "Ese nombre de usuario ya está en uso." }, 409);
    }

    // 1) Email de Auth (la credencial real de login).
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      objetivo.auth_user_id,
      { email: nuevoEmail, email_confirm: true },
    );
    if (authUpdateError) {
      return json({ error: authUpdateError.message }, 400);
    }

    // 2) Perfil: username + espejo synthetic_email. Si falla, revertimos el
    //    email de Auth para no dejar al usuario a medias.
    const { data: actualizado, error: dbUpdateError } = await adminClient
      .from("usuarios")
      .update({ username, synthetic_email: nuevoEmail })
      .eq("id", usuarioId)
      .select()
      .single();

    if (dbUpdateError) {
      await adminClient.auth.admin.updateUserById(objetivo.auth_user_id, {
        email: objetivo.synthetic_email,
        email_confirm: true,
      });
      return json({ error: dbUpdateError.message }, 400);
    }

    return json({ ok: true, usuario: actualizado });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error inesperado." }, 500);
  }
});
