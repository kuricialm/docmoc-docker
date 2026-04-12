import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("share_token", token)
    .eq("shared", true)
    .eq("trashed", false)
    .maybeSingle();

  if (error || !doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mode = url.searchParams.get("mode"); // "info" or "file"

  if (mode === "info") {
    return new Response(JSON.stringify(doc), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Default: return the file
  const { data: fileData, error: fileError } = await supabase.storage
    .from("documents")
    .download(doc.storage_path);

  if (fileError || !fileData) {
    return new Response(JSON.stringify({ error: "File not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(fileData, {
    headers: {
      ...corsHeaders,
      "Content-Type": doc.file_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.name}"`,
    },
  });
});
