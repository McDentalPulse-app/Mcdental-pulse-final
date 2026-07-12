import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor } from "../_shared/cors.ts";
import { TEMP_PASSWORD } from "../_shared/username.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    if (callerPerfilError || !["admin", "rh"].includes(callerPerfil?.role)) {
      return new Response(JSON.stringify({ error: "No tienes permiso para restablecer contraseñas." }), {
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

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: usuarioObjetivo, error: usuarioError } = await adminClient
      .from("usuarios")
      .select("auth_user_id, role")
      .eq("id", usuarioId)
      .single();

    if (usuarioError || !usuarioObjetivo?.auth_user_id) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sin esta guarda, un 'rh' podía restablecer la contraseña de un 'admin' a la temporal
    // y entrar como él — una escalada equivalente a cambiarse el rol, que las migraciones
    // 023/025 sí bloquean. RH conserva el reset del resto de usuarios.
    if (callerPerfil.role !== "admin" && usuarioObjetivo.role === "admin") {
      return new Response(JSON.stringify({ error: "Solo un administrador puede restablecer la contraseña de otro administrador." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      usuarioObjetivo.auth_user_id,
      { password: TEMP_PASSWORD },
    );
    if (updateAuthError) {
      return new Response(JSON.stringify({ error: updateAuthError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateDbError } = await adminClient
      .from("usuarios")
      .update({
        debe_cambiar_password: true,
        password_restablecido_en: new Date().toISOString(),
        password_restablecido_por: callerPerfil.id,
      })
      .eq("id", usuarioId);

    if (updateDbError) {
      return new Response(JSON.stringify({ error: updateDbError.message }), {
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
