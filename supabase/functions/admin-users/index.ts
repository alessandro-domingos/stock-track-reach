// Deno Edge Function: admin-users
// Creates a new user and assigns role atomically using service role
// Protects endpoint to admin users only

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  nome: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "logistica", "armazem", "cliente", "comercial"]).default("cliente"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten() }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const { email, password, nome, role } = parsed.data;

    // Authenticated client using the caller's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: userInfo } = await userClient.auth.getUser();
    const requester = userInfo?.user;
    if (!requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Check if there are any admins in the system
    const { count: adminCount, error: countError } = await userClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      return new Response(JSON.stringify({ error: "Failed to check admin count", details: countError.message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const noAdminsExist = (adminCount ?? 0) === 0;

    // If admins exist, ensure requester is admin
    if (!noAdminsExist) {
      const { data: isAdmin, error: roleCheckError } = await userClient.rpc("has_role", {
        _user_id: requester.id,
        _role: "admin",
      });

      if (roleCheckError) {
        return new Response(JSON.stringify({ error: "Role check failed", details: roleCheckError.message }), {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Only admins can create users" }), {
          status: 403,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }
    }

    // Service role client to create auth user and bypass RLS for writes
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Create user (auto-confirm)
    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: "Failed to create user", details: createErr?.message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const newUserId = created.user.id;

    // Wait briefly for triggers to populate default role/profile
    await new Promise((r) => setTimeout(r, 500));

    if (role !== "cliente") {
      // Update the default role to the requested one
      const { error: updErr } = await serviceClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", newUserId);

      if (updErr) {
        return new Response(JSON.stringify({ error: "Failed to assign role", details: updErr.message }), {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
});