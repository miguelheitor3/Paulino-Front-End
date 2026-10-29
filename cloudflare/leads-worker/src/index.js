const STATUS = new Set(["novo", "em_contato", "simulacao", "convertido", "encerrado"]);
const PROPERTY_TYPES = new Set([
  "Casa", "Apartamento", "Barracão", "Ponto Comercial",
  "Sítio/Fazenda", "Terreno", "Área de Lazer"
]);
const ENTRY_RANGES = new Set(["ate_20_mil", "20_a_50_mil", "50_a_100_mil", "acima_100_mil"]);
const LEAD_TYPES = new Set(["compra", "aluguel", "financiamento"]);
const SELLERS = new Set(["Thomas", "Antonio", "Sandra"]);
const MAX_BODY_BYTES = 12_000;

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = length => {
    let soma = 0;
    for (let i = 0; i < length; i++) soma += Number(cpf[i]) * (length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

function responseJson(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

async function validarAdmin(request, env) {
  const token = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: "Sessão necessária." };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ADMIN_EMAILS) {
    return { ok: false, status: 500, error: "Configuração de autenticação incompleta no Worker de leads." };
  }
  let resposta;
  try {
    resposta = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
  } catch {
    return { ok: false, status: 502, error: "Não foi possível validar a sessão agora." };
  }
  if (!resposta.ok) return { ok: false, status: 401, error: "Sessão expirada. Entre novamente." };
  const usuario = await resposta.json();
  const admins = String(env.ADMIN_EMAILS).split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(String(usuario.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "Esta conta não pode acessar os cadastros." };
  }
  return { ok: true };
}

async function lerJsonLimitado(request) {
  const declarado = Number(request.headers.get("Content-Length") || 0);
  if (declarado > MAX_BODY_BYTES) throw new Error("O cadastro excede o tamanho permitido.");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new Error("O cadastro excede o tamanho permitido.");
  try { return JSON.parse(body); } catch { throw new Error("Envie um cadastro válido."); }
}

function normalizarCadastro(body, manual = false) {
  const nome = String(body?.nome || "").trim().replace(/\s+/g, " ");
  const telefone = String(body?.telefone || "").replace(/\D/g, "");
  const email = String(body?.email || "").trim().toLowerCase();
  const cpf = String(body?.cpf || "").replace(/\D/g, "");
  const cidade = String(body?.cidade || "").trim().replace(/\s+/g, " ");
  const tipo = String(body?.tipo_imovel || "").trim();
  const valor = body?.valor_maximo === "" || body?.valor_maximo == null ? null : Number(body.valor_maximo);
  const quartos = body?.quartos_minimos === "" || body?.quartos_minimos == null ? null : Number(body.quartos_minimos);
  const entrada = String(body?.entrada_faixa || "").trim() || null;
  const observacoes = manual ? String(body?.observacoes || "").trim() : "";
  const fgts = body?.pretende_usar_fgts === "" || body?.pretende_usar_fgts == null
    ? null
    : body.pretende_usar_fgts === true || body.pretende_usar_fgts === "sim"
      ? 1
      : body.pretende_usar_fgts === false || body.pretende_usar_fgts === "nao"
        ? 0 : NaN;
  const tipoAtendimento = manual ? String(body?.tipo_atendimento || "").trim() : String(body?.tipo_atendimento || "financiamento").trim();
  const vendedorResponsavel = manual ? String(body?.vendedor_responsavel || "").trim() || null : null;
  const consentiuOfertasWhatsapp = body?.consentiu_ofertas_whatsapp === true ? 1 : 0;
  const boolField = value => value === true || value === "sim" ? 1 : value === false || value === "nao" ? 0 : null;
  const temImovelNome = boolField(body?.tem_imovel_nome);
  const moraTrabalhaTresPontas = boolField(body?.mora_trabalha_tres_pontas);
  const possuiFgts = boolField(body?.possui_fgts);
  const fgtsMais35 = boolField(body?.fgts_mais_35_contribuicoes);

  if (String(body?.website || "").trim()) return { spam: true };
  if (nome.length < 2 || nome.length > 100) throw new Error("Informe seu nome (até 100 caracteres).");
  if (telefone.length < 10 || telefone.length > 13) throw new Error("Informe um telefone com DDD.");
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Confira o e-mail informado.");
  if (cidade.length < 2 || cidade.length > 100) throw new Error("Informe a cidade desejada.");
  if (!LEAD_TYPES.has(tipoAtendimento)) throw new Error("Selecione compra, aluguel ou financiamento.");
  if (!manual && tipoAtendimento !== "financiamento" && consentiuOfertasWhatsapp !== 1) throw new Error("Autorize o recebimento de ofertas pelo WhatsApp para concluir o cadastro.");
  if (vendedorResponsavel && !SELLERS.has(vendedorResponsavel)) throw new Error("Selecione um vendedor válido.");
  if (tipo && !PROPERTY_TYPES.has(tipo)) throw new Error("Selecione um tipo de imóvel válido.");
  if (valor !== null && (!Number.isSafeInteger(valor) || valor < 1 || valor > 100_000_000)) throw new Error("Confira o valor máximo do imóvel.");
  if (quartos !== null && (!Number.isInteger(quartos) || quartos < 0 || quartos > 20)) throw new Error("Confira a quantidade mínima de quartos.");
  if (entrada && !ENTRY_RANGES.has(entrada)) throw new Error("Selecione uma faixa de entrada válida.");
  if (Number.isNaN(fgts)) throw new Error("Selecione uma opção válida sobre o FGTS.");
  if (cpf && !cpfValido(cpf)) throw new Error("Informe um CPF válido.");
  if (body?.formulario_financiamento === true && !cpfValido(cpf)) throw new Error("Informe um CPF válido para solicitar o financiamento.");
  if (body?.consentiu_contato !== true) throw new Error("É necessário autorizar o contato para enviar a solicitação.");
  if (observacoes.length > 2000) throw new Error("As observações podem ter até 2.000 caracteres.");

  return { nome, telefone, email: email || null, cidade, tipo_imovel: tipo || null,
    valor_maximo: valor, quartos_minimos: quartos, entrada_faixa: entrada,
    pretende_usar_fgts: fgts, consentiu_contato: 1, versao_aviso_privacidade: "2026-10-v3",
    tipo_atendimento: tipoAtendimento, origem_cadastro: manual ? "painel" : "site",
    vendedor_responsavel: vendedorResponsavel, consentiu_ofertas_whatsapp: consentiuOfertasWhatsapp,
    cpf: cpf || null, tem_imovel_nome: temImovelNome, mora_trabalha_tres_pontas: moraTrabalhaTresPontas,
    possui_fgts: possuiFgts, fgts_mais_35_contribuicoes: fgtsMais35, observacoes };
}

async function criarLead(request, env, cors) {
  let body;
  try { body = await lerJsonLimitado(request); }
  catch (error) { return responseJson({ error: error.message }, 400, cors); }
  let lead;
  try { lead = normalizarCadastro(body); }
  catch (error) { return responseJson({ error: error.message }, 400, cors); }
  // Resposta genérica para o campo invisível de honeypot, sem revelar o filtro.
  if (lead.spam) return responseJson({ ok: true }, 201, cors);

  try {
    const limite = await registrarTentativa(request, env);
    if (!limite.ok) return responseJson({ error: "Recebemos muitas tentativas deste acesso. Aguarde alguns minutos e tente novamente." }, 429, cors);
  } catch (error) {
    console.error("Falha ao aplicar limite de envio:", error);
    return responseJson({ error: "Não foi possível receber sua solicitação agora. Tente novamente em alguns minutos." }, 503, cors);
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO financing_leads
      (id, nome, telefone, email, cidade, tipo_imovel, valor_maximo, quartos_minimos,
       entrada_faixa, pretende_usar_fgts, consentiu_contato, versao_aviso_privacidade,
       tipo_atendimento, origem_cadastro, vendedor_responsavel, consentiu_ofertas_whatsapp,
       cpf, tem_imovel_nome, mora_trabalha_tres_pontas, possui_fgts, fgts_mais_35_contribuicoes, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, lead.nome, lead.telefone, lead.email, lead.cidade, lead.tipo_imovel,
        lead.valor_maximo, lead.quartos_minimos, lead.entrada_faixa, lead.pretende_usar_fgts,
        lead.consentiu_contato, lead.versao_aviso_privacidade, lead.tipo_atendimento, lead.origem_cadastro, lead.vendedor_responsavel, lead.consentiu_ofertas_whatsapp,
        lead.cpf, lead.tem_imovel_nome, lead.mora_trabalha_tres_pontas, lead.possui_fgts, lead.fgts_mais_35_contribuicoes, lead.observacoes).run();
  } catch (error) {
    console.error("Falha ao gravar lead de financiamento:", error);
    return responseJson({ error: "Não foi possível salvar sua solicitação agora. Tente novamente." }, 503, cors);
  }
  return responseJson({ ok: true, id }, 201, cors);
}

async function criarLeadManual(request, env, cors) {
  const auth = await validarAdmin(request, env);
  if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
  let body;
  try { body = await lerJsonLimitado(request); }
  catch (error) { return responseJson({ error: error.message }, 400, cors); }
  let lead;
  try { lead = normalizarCadastro(body, true); }
  catch (error) { return responseJson({ error: error.message }, 400, cors); }
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO financing_leads
      (id, nome, telefone, email, cidade, tipo_imovel, valor_maximo, quartos_minimos,
       entrada_faixa, pretende_usar_fgts, consentiu_contato, versao_aviso_privacidade,
       tipo_atendimento, origem_cadastro, vendedor_responsavel, consentiu_ofertas_whatsapp,
       cpf, tem_imovel_nome, mora_trabalha_tres_pontas, possui_fgts, fgts_mais_35_contribuicoes, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, lead.nome, lead.telefone, lead.email, lead.cidade, lead.tipo_imovel,
        lead.valor_maximo, lead.quartos_minimos, lead.entrada_faixa, lead.pretende_usar_fgts,
        lead.consentiu_contato, lead.versao_aviso_privacidade, lead.tipo_atendimento, lead.origem_cadastro, lead.vendedor_responsavel, lead.consentiu_ofertas_whatsapp,
        lead.cpf, lead.tem_imovel_nome, lead.mora_trabalha_tres_pontas, lead.possui_fgts, lead.fgts_mais_35_contribuicoes, lead.observacoes).run();
  } catch (error) {
    console.error("Falha ao gravar cadastro manual:", error);
    return responseJson({ error: "Não foi possível salvar o cadastro agora." }, 503, cors);
  }
  return responseJson({ ok: true, id }, 201, cors);
}

async function registrarTentativa(request, env) {
  if (!env.RATE_LIMIT_SECRET) throw new Error("RATE_LIMIT_SECRET não configurado.");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.RATE_LIMIT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  const ipHash = [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const windowNumber = Math.floor(now / windowMs);
  const bucket = `${ipHash}:${windowNumber}`;
  const expiresAt = (windowNumber + 1) * windowMs;
  await env.DB.prepare("DELETE FROM lead_submission_limits WHERE expires_at < ?").bind(now).run();
  await env.DB.prepare(`INSERT INTO lead_submission_limits (bucket_key, expires_at, request_count)
    VALUES (?, ?, 1) ON CONFLICT(bucket_key) DO UPDATE SET request_count = request_count + 1`)
    .bind(bucket, expiresAt).run();
  const row = await env.DB.prepare("SELECT request_count FROM lead_submission_limits WHERE bucket_key = ?")
    .bind(bucket).first();
  return { ok: Number(row?.request_count || 0) <= 5 };
}

async function listarLeads(request, env, cors) {
  const auth = await validarAdmin(request, env);
  if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "250", 10) || 250));
  try {
    const { results } = await env.DB.prepare(`SELECT id, created_at, updated_at, nome, telefone,
      email, cidade, tipo_imovel, valor_maximo, quartos_minimos, entrada_faixa,
      pretende_usar_fgts, cpf, tem_imovel_nome, mora_trabalha_tres_pontas, possui_fgts, fgts_mais_35_contribuicoes,
      status, observacoes, tipo_atendimento, origem_cadastro, vendedor_responsavel,
      consentiu_ofertas_whatsapp
      FROM financing_leads ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
    const { results: offers } = await env.DB.prepare("SELECT lead_id, property_id, sent_at FROM lead_property_offers").all();
    const sentByLead = new Map();
    for (const offer of offers || []) {
      if (!sentByLead.has(offer.lead_id)) sentByLead.set(offer.lead_id, []);
      sentByLead.get(offer.lead_id).push({ property_id: offer.property_id, sent_at: offer.sent_at });
    }
    return responseJson({ leads: (results || []).map(lead => ({ ...lead, sent_offers: sentByLead.get(lead.id) || [] })) }, 200, cors);
  } catch (error) {
    console.error("Falha ao listar leads:", error);
    return responseJson({ error: "Não foi possível carregar os cadastros." }, 503, cors);
  }
}

async function atualizarLead(request, env, cors, id) {
  const auth = await validarAdmin(request, env);
  if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return responseJson({ error: "Cadastro não encontrado." }, 404, cors);
  let body;
  try { body = await lerJsonLimitado(request); }
  catch (error) { return responseJson({ error: error.message }, 400, cors); }
  const status = String(body?.status || "");
  const observacoes = String(body?.observacoes || "").trim();
  if (!STATUS.has(status)) return responseJson({ error: "Selecione uma situação válida." }, 400, cors);
  if (observacoes.length > 2000) return responseJson({ error: "As observações podem ter até 2.000 caracteres." }, 400, cors);
  let cadastro = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, "tipo_atendimento")) {
    try { cadastro = normalizarCadastro({ ...body, consentiu_contato: true }, true); }
    catch (error) { return responseJson({ error: error.message }, 400, cors); }
  }
  try {
    const result = cadastro
      ? await env.DB.prepare(`UPDATE financing_leads SET
          nome = ?, telefone = ?, email = ?, cidade = ?, tipo_imovel = ?, valor_maximo = ?,
          quartos_minimos = ?, entrada_faixa = ?, pretende_usar_fgts = ?, tipo_atendimento = ?, vendedor_responsavel = ?,
          consentiu_ofertas_whatsapp = ?,
          cpf = ?, tem_imovel_nome = ?, mora_trabalha_tres_pontas = ?, possui_fgts = ?, fgts_mais_35_contribuicoes = ?,
          status = ?, observacoes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`).bind(cadastro.nome, cadastro.telefone, cadastro.email, cadastro.cidade,
          cadastro.tipo_imovel, cadastro.valor_maximo, cadastro.quartos_minimos,
          cadastro.entrada_faixa, cadastro.pretende_usar_fgts, cadastro.tipo_atendimento, cadastro.vendedor_responsavel,
          cadastro.consentiu_ofertas_whatsapp,
          cadastro.cpf, cadastro.tem_imovel_nome, cadastro.mora_trabalha_tres_pontas,
          cadastro.possui_fgts, cadastro.fgts_mais_35_contribuicoes,
          status, observacoes, id).run()
      : await env.DB.prepare(`UPDATE financing_leads
          SET status = ?, observacoes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`).bind(status, observacoes, id).run();
    if (!result.meta?.changes) return responseJson({ error: "Cadastro não encontrado." }, 404, cors);
    return responseJson({ ok: true }, 200, cors);
  } catch (error) {
    console.error("Falha ao atualizar lead:", error);
    return responseJson({ error: "Não foi possível atualizar o cadastro." }, 503, cors);
  }
}

async function excluirLead(request, env, cors, id) {
  const auth = await validarAdmin(request, env);
  if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return responseJson({ error: "Cadastro não encontrado." }, 404, cors);
  try {
    const result = await env.DB.prepare("DELETE FROM financing_leads WHERE id = ?").bind(id).run();
    if (!result.meta?.changes) return responseJson({ error: "Cadastro não encontrado." }, 404, cors);
    return responseJson({ ok: true }, 200, cors);
  } catch (error) {
    console.error("Falha ao excluir lead:", error);
    return responseJson({ error: "Não foi possível excluir o cadastro." }, 503, cors);
  }
}

async function marcarOfertaEnviada(request, env, cors, leadId) {
  const auth = await validarAdmin(request, env);
  if (!auth.ok) return responseJson({ error: auth.error }, auth.status, cors);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) return responseJson({ error: "Cadastro não encontrado." }, 404, cors);
  let body;
  try { body = await lerJsonLimitado(request); } catch (error) { return responseJson({ error: error.message }, 400, cors); }
  const propertyId = String(body?.property_id || "").trim();
  if (!propertyId || propertyId.length > 200 || typeof body?.sent !== "boolean") return responseJson({ error: "Informe o imóvel e a situação do envio." }, 400, cors);
  try {
    if (body.sent) {
      await env.DB.prepare(`INSERT INTO lead_property_offers (lead_id, property_id) VALUES (?, ?)
        ON CONFLICT(lead_id, property_id) DO NOTHING`).bind(leadId, propertyId).run();
    } else {
      await env.DB.prepare("DELETE FROM lead_property_offers WHERE lead_id = ? AND property_id = ?").bind(leadId, propertyId).run();
    }
    const { results } = await env.DB.prepare("SELECT property_id, sent_at FROM lead_property_offers WHERE lead_id = ?").bind(leadId).all();
    return responseJson({ ok: true, sent_offers: results || [] }, 200, cors);
  } catch (error) {
    console.error("Falha ao atualizar o histórico de ofertas:", error);
    return responseJson({ error: "Não foi possível atualizar a situação do imóvel enviado." }, 503, cors);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response("Origem não permitida.", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    if (request.method === "POST" && path === "/api/leads") return criarLead(request, env, cors);
    if (request.method === "POST" && path === "/api/admin/leads") return criarLeadManual(request, env, cors);
    if (request.method === "GET" && path === "/api/admin/leads") return listarLeads(request, env, cors);
    const offerMatch = path.match(/^\/api\/admin\/leads\/([^/]+)\/offers$/);
    if (request.method === "PATCH" && offerMatch) return marcarOfertaEnviada(request, env, cors, offerMatch[1]);
    const match = path.match(/^\/api\/admin\/leads\/([^/]+)$/);
    if (request.method === "PATCH" && match) return atualizarLead(request, env, cors, match[1]);
    if (request.method === "DELETE" && match) return excluirLead(request, env, cors, match[1]);
    return responseJson({ error: "Rota não encontrada." }, 404, cors);
  }
};
