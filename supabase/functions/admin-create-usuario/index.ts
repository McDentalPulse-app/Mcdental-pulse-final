import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor } from "../_shared/cors.ts";
import { usernameToSyntheticEmail, TEMP_PASSWORD } from "../_shared/username.ts";

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

    // Cliente con el JWT del caller: respeta RLS, solo para leer su propio rol.
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
      .select("role")
      .eq("auth_user_id", callerAuthUser.id)
      .single();

    if (callerPerfilError || !["admin", "rh"].includes(callerPerfil?.role)) {
      return new Response(JSON.stringify({ error: "No tienes permiso para crear usuarios." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      name, username, role, sucursal, puesto, telefono, email,
      fechaIngreso, fechaCumpleanos,
    } = body;

    if (!name || !username || !role) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos (name, username, role)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El insert de abajo usa service_role, que bypassa RLS, y el trigger
    // prevent_usuario_privilege_escalation (mig 023/025) solo cubre UPDATE — así que sin
    // esta guarda un 'rh' podía crear una cuenta 'admin' y entrar con la temporal,
    // saltándose la restricción de rol que esas migraciones cierran para el UPDATE.
    // Solo un admin puede asignar un rol privilegiado al crear.
    if (callerPerfil?.role !== "admin" && role !== "empleado") {
      return new Response(JSON.stringify({ error: "Solo un administrador puede crear usuarios con un rol distinto de empleado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const syntheticEmail = usernameToSyntheticEmail(username);

    // usernameToSyntheticEmail() sanea el username quitando todo lo que no sea
    // [a-z0-9._-]. Un username compuesto solo de caracteres inválidos ("###") queda en
    // nada y produce el email "@mcdental.internal", que crearía una cuenta inutilizable.
    // admin-update-username ya validaba esto; aquí faltaba.
    if (syntheticEmail.startsWith("@")) {
      return new Response(JSON.stringify({ error: "Nombre de usuario inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente service_role: única forma de crear usuarios en auth.users.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });

    if (createAuthError || !createdAuthUser?.user) {
      return new Response(JSON.stringify({ error: createAuthError?.message || "No se pudo crear el acceso del usuario." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nuevoUsuario, error: insertError } = await adminClient
      .from("usuarios")
      .insert({
        auth_user_id: createdAuthUser.user.id,
        name,
        username,
        synthetic_email: syntheticEmail,
        role,
        sucursal,
        puesto,
        telefono,
        email,
        fecha_ingreso: fechaIngreso || null,
        fecha_cumpleanos: fechaCumpleanos || null,
        debe_cambiar_password: true,
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: no dejar un usuario huérfano en auth.users sin fila en usuarios.
      await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ usuario: nuevoUsuario }), {
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
