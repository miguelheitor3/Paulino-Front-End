// ============================================================
// PAULINO IMÓVEIS — SITE.JS
// Cliente Supabase + funções compartilhadas por todas as páginas
// (index.html, imovel.html, admin.html)
// ============================================================

(function () {
  "use strict";

  // ------------------------------------------------------------
  // SUPABASE
  // ------------------------------------------------------------

  if (!window.supabase) {
    console.error("Biblioteca Supabase não carregada.");
    return;
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error("SUPABASE_URL ou SUPABASE_ANON_KEY não encontrados em config.js.");
    return;
  }

  if (!window.sb) {
    window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  const sb = window.sb;

  // Colunas usadas nos cards/listagens (evita trazer campos desnecessários do banco)
  const CAMPOS_LISTAGEM =
    "id,codigo,titulo,tipo,finalidade,cidade,bairro,preco,area_construida_m2,area_terreno_m2,quartos,banheiros,vagas,fotos,destaque_manual,disponivel,visualizacoes,criado_em";

  // ------------------------------------------------------------
  // UTILITÁRIOS
  // ------------------------------------------------------------

  function escapeHtml(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  window.escapeHtml = escapeHtml;

  // ------------------------------------------------------------
  // PREÇO
  // ------------------------------------------------------------

  function fmtPreco(valor) {
    if (valor === null || valor === undefined || valor === "") return "Sob consulta";
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "Sob consulta";
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  window.fmtPreco = fmtPreco;

  // Máscara ao vivo em campos <input> — digita "100000" e vira "100.000,00"
  function aplicarMascaraMoeda(input) {
    if (!input) return;
    input.addEventListener("input", (ev) => {
      let digitos = ev.target.value.replace(/\D/g, "");
      if (!digitos) { ev.target.value = ""; return; }
      digitos = digitos.slice(0, 12);
      const numero = parseInt(digitos, 10) / 100;
      ev.target.value = numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }
  window.aplicarMascaraMoeda = aplicarMascaraMoeda;

  // Converte "100.000,00" (texto digitado) de volta para Number
  function parsePrecoBR(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const limpo = String(valor).replace(/\./g, "").replace(",", ".").trim();
    if (!limpo) return null;
    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : null;
  }
  window.parsePrecoBR = parsePrecoBR;

  // Formata um número vindo do banco para preencher um campo com máscara (ex: ao editar)
  function formatarPrecoBR(valor) {
    if (valor === null || valor === undefined || valor === "") return "";
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "";
    return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  window.formatarPrecoBR = formatarPrecoBR;

  // ------------------------------------------------------------
  // FOTOS (Supabase Storage)
  // ------------------------------------------------------------

  const PLACEHOLDER_FOTO = "https://via.placeholder.com/600x450?text=Sem+foto";

  // Resolve tanto caminhos salvos no Storage ("1699-xyz.jpg")
  // quanto URLs completas que já venham prontas do banco.
  function urlFoto(caminho) {
    if (!caminho) return PLACEHOLDER_FOTO;
    caminho = String(caminho).trim();
    if (!caminho) return PLACEHOLDER_FOTO;

    if (caminho.startsWith("https://") || caminho.startsWith("http://")) {
      return caminho;
    }

    const { data } = sb.storage.from("fotos-imoveis").getPublicUrl(caminho);
    return data?.publicUrl || PLACEHOLDER_FOTO;
  }
  window.urlFoto = urlFoto;

  // ------------------------------------------------------------
  // FINALIDADE
  // ------------------------------------------------------------

  function normalizarTexto(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }
  window.normalizarTexto = normalizarTexto;

  function rotuloFinalidade(finalidade) {
    const valor = normalizarTexto(finalidade);
    if (valor === "alugar" || valor === "locacao") return { texto: "Aluguel", classe: "aluguel" };
    if (valor === "temporada") return { texto: "Temporada", classe: "temporada" };
    return { texto: "Venda", classe: "venda" };
  }
  window.rotuloFinalidade = rotuloFinalidade;

  // ------------------------------------------------------------
  // CARD DO IMÓVEL (leve: só a 1ª foto carrega de imediato;
  // as demais fotos do carrossel só são buscadas ao clicar nas setas)
  // ------------------------------------------------------------

  function cardHtml(im, destaque) {
    const fotos = Array.isArray(im.fotos) ? im.fotos.filter(Boolean) : [];
    const primeiraFoto = fotos.length ? urlFoto(fotos[0]) : "";
    const fin = rotuloFinalidade(im.finalidade);
    const titulo = escapeHtml(im.titulo || "Imóvel");
    const temCarrossel = fotos.length > 1;

    const specs = [];
    if (im.area_construida_m2) specs.push(`<span>🏠 ${escapeHtml(im.area_construida_m2)} m² construída</span>`);
    if (im.area_terreno_m2) specs.push(`<span>🌿 ${escapeHtml(im.area_terreno_m2)} m² terreno</span>`);
    if (im.quartos) specs.push(`<span>🛏 ${escapeHtml(im.quartos)}</span>`);
    if (im.vagas) specs.push(`<span>🚗 ${escapeHtml(im.vagas)}</span>`);

    // data-fotos guarda os caminhos originais (não as URLs já resolvidas) para
    // resolver a próxima/anterior foto só quando o usuário realmente clicar.
    const fotosJson = escapeHtml(JSON.stringify(fotos));

    return `
      <a class="card" href="imovel.html?id=${encodeURIComponent(im.id)}">
        <div class="card-photo" data-fotos="${fotosJson}" data-foto-index="0">
          <div class="carousel-imgs">
            ${primeiraFoto
              ? `<img src="${primeiraFoto}" loading="lazy" decoding="async" alt="${titulo}" onerror="this.src='${PLACEHOLDER_FOTO}';">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#7b847e;font-size:13px;">Sem foto</div>`
            }
          </div>
          <div class="card-tags">
            ${destaque || im.destaque_manual ? '<span class="tag-destaque">Destaque</span>' : ""}
            <span class="tag-finalidade ${fin.classe}">${fin.texto}</span>
          </div>
          ${temCarrossel ? `
            <button type="button" class="carousel-btn prev" aria-label="Foto anterior" data-carousel="prev">‹</button>
            <button type="button" class="carousel-btn next" aria-label="Próxima foto" data-carousel="next">›</button>
            <div class="carousel-dots">
              ${fotos.slice(0, 8).map((_, i) => `<span class="dot ${i === 0 ? "ativa" : ""}"></span>`).join("")}
            </div>
          ` : ""}
        </div>
        <div class="card-body">
          <div class="card-price">${escapeHtml(fmtPreco(im.preco))}</div>
          <div class="card-code">${im.codigo ? "Código " + escapeHtml(im.codigo) : ""}</div>
          <div class="card-title">${titulo}</div>
          <div class="card-place">${escapeHtml([im.bairro, im.cidade].filter(Boolean).join(", "))}</div>
          ${specs.length ? `<div class="card-specs">${specs.join("")}</div>` : ""}
        </div>
      </a>`;
  }
  window.cardHtml = cardHtml;

  // ------------------------------------------------------------
  // CARROSSEL SOB DEMANDA + DELEGAÇÃO DE EVENTOS DOS CARDS
  // (registrado uma única vez, mesmo se site.js for incluído em várias páginas)
  // ------------------------------------------------------------

  function trocarFotoCard(cardPhoto, direcao) {
    let fotos = [];
    try { fotos = JSON.parse(cardPhoto.getAttribute("data-fotos") || "[]"); } catch { return; }
    if (fotos.length <= 1) return;

    let indice = Number(cardPhoto.getAttribute("data-foto-index") || 0);
    indice = (indice + direcao + fotos.length) % fotos.length;
    cardPhoto.setAttribute("data-foto-index", indice);

    const container = cardPhoto.querySelector(".carousel-imgs");
    if (!container) return;

    const img = container.querySelector("img");
    const src = urlFoto(fotos[indice]);
    if (img) {
      img.src = src;
      img.alt = `Foto ${indice + 1}`;
    } else {
      container.innerHTML = `<img src="${src}" loading="lazy" decoding="async" alt="Foto ${indice + 1}">`;
    }

    cardPhoto.querySelectorAll(".carousel-dots .dot").forEach((dot, i) => dot.classList.toggle("ativa", i === indice));
  }
  window.trocarFotoCard = trocarFotoCard;

  if (!window.__paulinoCardEvents) {
    window.__paulinoCardEvents = true;

    document.addEventListener("click", (ev) => {
      const botaoCarrossel = ev.target.closest("[data-carousel]");
      if (botaoCarrossel) {
        ev.preventDefault();
        ev.stopPropagation();
        const cardPhoto = botaoCarrossel.closest(".card-photo");
        if (cardPhoto) trocarFotoCard(cardPhoto, botaoCarrossel.dataset.carousel === "next" ? 1 : -1);
        return;
      }

      const dot = ev.target.closest(".carousel-dots .dot");
      if (dot) {
        ev.preventDefault();
        ev.stopPropagation();
        const cardPhoto = dot.closest(".card-photo");
        if (!cardPhoto) return;
        const dots = [...cardPhoto.querySelectorAll(".carousel-dots .dot")];
        const indiceClicado = dots.indexOf(dot);
        const indiceAtual = Number(cardPhoto.getAttribute("data-foto-index") || 0);
        if (indiceClicado !== -1) trocarFotoCard(cardPhoto, indiceClicado - indiceAtual);
      }
    });
  }

  // ------------------------------------------------------------
  // BUSCAR IMÓVEIS
  // - Sem "pagina": comportamento simples (usado nos destaques, hero etc.),
  //   devolve um array pronto, com "limite" opcional.
  // - Com "pagina": pagina no próprio banco (usando .range) e devolve
  //   { imoveis, total }, para listagens com "carregar mais".
  // - O filtro de preço é aplicado sempre no banco (gte/lte), nunca dividido
  //   por 100 nem manipulado no front — corrigido aqui na origem.
  // ------------------------------------------------------------

  async function buscarImoveis({
    finalidade, tipo, cidade, bairro,
    quartosMin, precoMin, precoMax,
    ordenarPorViews, limite, pagina,
    colunas
  } = {}) {

    const usaPaginacao = pagina !== null && pagina !== undefined;
    const tamanhoPagina = limite || 12;

    let query = sb
      .from("imoveis")
      .select(colunas || CAMPOS_LISTAGEM, usaPaginacao ? { count: "exact" } : undefined)
      .eq("disponivel", true);

    if (finalidade && finalidade !== "Qualquer") query = query.eq("finalidade", finalidade);
    if (tipo && tipo !== "Qualquer") query = query.eq("tipo", tipo);
    if (cidade && cidade !== "Todas") query = query.eq("cidade", cidade);
    if (bairro && bairro !== "Todos") query = query.eq("bairro", bairro);
    if (quartosMin) query = query.gte("quartos", quartosMin);
    if (precoMin !== null && precoMin !== undefined && precoMin !== "") query = query.gte("preco", precoMin);
    if (precoMax !== null && precoMax !== undefined && precoMax !== "") query = query.lte("preco", precoMax);

    if (ordenarPorViews) {
      query = query.order("destaque_manual", { ascending: false }).order("visualizacoes", { ascending: false });
    } else {
      query = query.order("criado_em", { ascending: false });
    }

    if (usaPaginacao) {
      query = query.range(pagina * tamanhoPagina, pagina * tamanhoPagina + tamanhoPagina - 1);
    } else if (limite) {
      query = query.limit(limite);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro ao buscar imóveis:", error);
      return usaPaginacao ? { imoveis: [], total: 0 } : [];
    }

    return usaPaginacao ? { imoveis: data || [], total: count || 0 } : (data || []);
  }
  window.buscarImoveis = buscarImoveis;

  // Preenche um <select> com valores distintos de uma coluna (usado em telas simples)
  async function preencherSelectDistintos(selectEl, coluna) {
    const { data, error } = await sb.from("imoveis").select(coluna).eq("disponivel", true);
    if (error || !data) return;
    const valores = [...new Set(data.map((r) => r[coluna]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const primeira = selectEl.options[0];
    selectEl.innerHTML = "";
    selectEl.appendChild(primeira);
    valores.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }
  window.preencherSelectDistintos = preencherSelectDistintos;

})();
