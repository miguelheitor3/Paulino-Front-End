const MAX_UPLOAD_BYTES = 50 * 1000 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

function responseJson(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://www.paulinoimobiliaria.com.br,https://paulinoimobiliaria.com.br")
    .split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

async function validarAdmin(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: "Sessão necessária." };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ADMIN_EMAILS) {
    return { ok: false, status: 500, error: "Configuração de autenticação incompleta no Worker." };
  }

  const resposta = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!resposta.ok) return { ok: false, status: 401, error: "Sessão expirada. Entre novamente." };
  const usuario = await resposta.json();
  const admins = String(env.ADMIN_EMAILS).split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(String(usuario.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "Esta conta não pode alterar arquivos." };
  }
  return { ok: true };
}

function validarChave(chave) {
  return KEY_PATTERN.test(chave) && !chave.split("/").some(parte => parte === "." || parte === "..");
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response("Origem não permitida.", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "PUT" && url.pathname.startsWith("/objects/")) {
      const auth = await validarAdmin(request, env);
      if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
      let chave;
      try { chave = decodeURIComponent(url.pathname.slice("/objects/".length)); }
      catch { return responseJson({ error: "Caminho de arquivo inválido." }, 400, cors); }
      if (!validarChave(chave)) return responseJson({ error: "Caminho de arquivo inválido." }, 400, cors);
      const tamanhoDeclarado = request.headers.get("Content-Length");
      if (tamanhoDeclarado && Number(tamanhoDeclarado) > MAX_UPLOAD_BYTES) {
        return responseJson({ error: "O arquivo deve ter até 50 MB." }, 413, cors);
      }
      if (!request.body) return responseJson({ error: "Arquivo vazio." }, 400, cors);
      let totalRecebido = 0;
      let excedeuLimite = false;
      const corpoLimitado = request.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          totalRecebido += chunk.byteLength;
          if (totalRecebido > MAX_UPLOAD_BYTES) {
            excedeuLimite = true;
            controller.error(new Error("FILE_TOO_LARGE"));
            return;
          }
          controller.enqueue(chunk);
        }
      }));
      try {
        await env.IMOVEIS.put(chave, corpoLimitado, {
          httpMetadata: { contentType: request.headers.get("Content-Type") || "application/octet-stream" },
          customMetadata: { uploadedAt: new Date().toISOString() }
        });
      } catch (error) {
        if (excedeuLimite) return responseJson({ error: "O arquivo deve ter até 50 MB." }, 413, cors);
        throw error;
      }
      if (!totalRecebido) return responseJson({ error: "Arquivo vazio." }, 400, cors);
      return responseJson({ ok: true, key: chave }, 201, cors);
    }

    if (request.method === "DELETE" && url.pathname === "/objects") {
      const auth = await validarAdmin(request, env);
      if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
      let body;
      try { body = await request.json(); } catch { return responseJson({ error: "Lista de arquivos inválida." }, 400, cors); }
      const keys = Array.isArray(body?.keys) ? body.keys : [];
      if (!keys.length || keys.length > 100 || keys.some(key => !validarChave(key))) {
        return responseJson({ error: "Lista de arquivos inválida." }, 400, cors);
      }
      await Promise.all(keys.map(key => env.IMOVEIS.delete(key)));
      return responseJson({ ok: true, deleted: keys.length }, 200, cors);
    }

    return responseJson({ error: "Rota não encontrada." }, 404, cors);
  }
};
