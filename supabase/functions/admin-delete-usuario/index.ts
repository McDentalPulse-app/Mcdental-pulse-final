import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Borra un usuario de verdad: auth.users tiene auth_user_id references ... on delete
// cascade (mig 004), y prácticamente todas las tablas de negocio (asistencias,
// encuestas, rostros, permisos, vacaciones...) tienen on delete cascade hacia
// usuarios. Borrar es perder TODO el historial de esa persona para siempre — el
// cliente ya avisa esto con dos confirmaciones antes de llamar acá. Solo admin (no
// rh, a diferencia de admin-reset-password): es más grave que resetear una contraseña.
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuthUser }, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuthUser) {
      return new Response(JSON.stringify({ error: "No autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerPerfil, error: callerPerfilError } = await callerClient
      .from("usuarios")
      .select("id, role")
      .eq("auth_user_id", callerAuthUser.id)
      .single();

    if (callerPerfilError || callerPerfil?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo un administrador puede eliminar usuarios." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { usuarioId } = await req.json();
    if (!usuarioId) {
      return new Response(JSON.stringify({ error: "Falta 'usuarioId'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (usuarioId === callerPerfil.id) {
      return new Response(JSON.stringify({ error: "No podés eliminar tu propia cuenta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: usuarioObjetivo, error: usuarioError } = await adminClient
      .from("usuarios")
      .select("auth_user_id")
      .eq("id", usuarioId)
      .single();

    if (usuarioError || !usuarioObjetivo?.auth_user_id) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(usuarioObjetivo.auth_user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
