// ============================================================
// PAULINO IMÓVEIS — SITE.JS
// Cliente Supabase compartilhado pelo site e pelo painel admin
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
    console.error(
      "SUPABASE_URL ou SUPABASE_ANON_KEY não encontrados em config.js."
    );
    return;
  }

  if (!window.sb) {
    window.sb = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }

  const sb = window.sb;

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

  // Disponibiliza para outros arquivos, principalmente admin.html
  window.escapeHtml = escapeHtml;

  // ------------------------------------------------------------
  // PREÇO
  // ------------------------------------------------------------

  function fmtPreco(valor) {
    if (valor === null || valor === undefined || valor === "") {
      return "Sob consulta";
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return "Sob consulta";
    }

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    });
  }

  window.fmtPreco = fmtPreco;

  function formatarPrecoBR(valor) {
    if (valor === null || valor === undefined || valor === "") {
      return "";
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return "";
    }

    return numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  window.formatarPrecoBR = formatarPrecoBR;

  function parsePrecoBR(valor) {
    if (valor === null || valor === undefined || valor === "") {
      return null;
    }

    let texto = String(valor)
      .trim()
      .replace(/\s/g, "")
      .replace(/^R\$/i, "")
      .trim();

    if (!texto) return null;

    // Se houver ponto e vírgula:
    // 100.000,50 -> 100000.50
    if (texto.includes(".") && texto.includes(",")) {
      texto = texto
        .replace(/\./g, "")
        .replace(",", ".");
    }

    // Apenas vírgula:
    // 100000,50 -> 100000.50
    else if (texto.includes(",")) {
      texto = texto.replace(",", ".");
    }

    // Apenas ponto:
    // Mantém como decimal.
    // Isso é importante para valores vindos diretamente do banco.

    const numero = Number(texto);

    return Number.isFinite(numero) ? numero : null;
  }

  window.parsePrecoBR = parsePrecoBR;

  function aplicarMascaraMoeda(input) {
    if (!input) return;

    input.addEventListener("input", function (event) {
      let valor = event.target.value.replace(/\D/g, "");

      if (!valor) {
        event.target.value = "";
        return;
      }

      valor = (Number(valor) / 100).toFixed(2);

      event.target.value = Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    });
  }

  window.aplicarMascaraMoeda = aplicarMascaraMoeda;

  // ------------------------------------------------------------
  // STORAGE — FOTOS
  // ------------------------------------------------------------

  function urlFoto(caminho) {
    if (!caminho) {
      return "https://via.placeholder.com/600x450?text=Sem+foto";
    }

    caminho = String(caminho).trim();

    if (!caminho) {
      return "https://via.placeholder.com/600x450?text=Sem+foto";
    }

    // Já é URL completa
    if (
      caminho.startsWith("https://") ||
      caminho.startsWith("http://")
    ) {
      return caminho;
    }

    const { data } = sb.storage
      .from("fotos-imoveis")
      .getPublicUrl(caminho);

    return data?.publicUrl ||
      "https://via.placeholder.com/600x450?text=Sem+foto";
  }

  window.urlFoto = urlFoto;

  // ------------------------------------------------------------
  // FINALIDADE
  // ------------------------------------------------------------

  function rotuloFinalidade(finalidade) {
    if (finalidade === "Alugar") {
      return {
        texto: "Aluguel",
        classe: "aluguel"
      };
    }

    if (finalidade === "Temporada") {
      return {
        texto: "Temporada",
        classe: "temporada"
      };
    }

    return {
      texto: "Venda",
      classe: "venda"
    };
  }

  window.rotuloFinalidade = rotuloFinalidade;

  // ------------------------------------------------------------
  // CARD DO IMÓVEL
  // ------------------------------------------------------------

  function cardHtml(imovel, destaque = false) {
    const fotos =
      Array.isArray(imovel.fotos) && imovel.fotos.length
        ? imovel.fotos.map(urlFoto)
        : [urlFoto(null)];

    const specs = [];

    if (
      imovel.area_construida_m2 !== null &&
      imovel.area_construida_m2 !== undefined &&
      imovel.area_construida_m2 !== ""
    ) {
      specs.push(
        `Const.: ${escapeHtml(imovel.area_construida_m2)} m²`
      );
    }

    if (
      imovel.area_terreno_m2 !== null &&
      imovel.area_terreno_m2 !== undefined &&
      imovel.area_terreno_m2 !== ""
    ) {
      specs.push(
        `Terr.: ${escapeHtml(imovel.area_terreno_m2)} m²`
      );
    }

    if (
      imovel.quartos !== null &&
      imovel.quartos !== undefined &&
      imovel.quartos !== ""
    ) {
      specs.push(`${escapeHtml(imovel.quartos)} qts`);
    }

    if (
      imovel.banheiros !== null &&
      imovel.banheiros !== undefined &&
      imovel.banheiros !== ""
    ) {
      specs.push(`${escapeHtml(imovel.banheiros)} ban.`);
    }

    if (
      imovel.vagas !== null &&
      imovel.vagas !== undefined &&
      imovel.vagas !== ""
    ) {
      specs.push(`${escapeHtml(imovel.vagas)} vagas`);
    }

    const fin = rotuloFinalidade(imovel.finalidade);

    const titulo = escapeHtml(imovel.titulo || "Imóvel");

    const imgsHtml = fotos
      .map(
        (foto, index) => `
          <img
            src="${escapeHtml(foto)}"
            class="${index === 0 ? "ativa" : ""}"
            alt="${titulo}"
            loading="lazy"
            onerror="this.src='https://via.placeholder.com/600x450?text=Sem+foto';"
          >
        `
      )
      .join("");

    const setasHtml =
      fotos.length > 1
        ? `
          <button
            type="button"
            class="carousel-btn prev"
            aria-label="Foto anterior"
          >&#8249;</button>

          <button
            type="button"
            class="carousel-btn next"
            aria-label="Próxima foto"
          >&#8250;</button>

          <div class="carousel-dots">
            ${fotos
              .map(
                (_, index) =>
                  `<span class="dot ${
                    index === 0 ? "ativa" : ""
                  }"></span>`
              )
              .join("")}
          </div>
        `
        : "";

    const codigo = imovel.codigo
      ? `Código ${escapeHtml(imovel.codigo)}`
      : "";

    const local = [imovel.bairro, imovel.cidade]
      .filter(Boolean)
      .map(escapeHtml)
      .join(", ");

    return `
      <div
        class="card"
        data-href="imovel.html?id=${encodeURIComponent(imovel.id)}"
        style="cursor:pointer;"
      >

        <div class="card-photo">

          <div class="card-tags">
            ${
              destaque
                ? '<span class="tag-destaque">Destaque</span>'
                : ""
            }

            <span class="tag-finalidade ${escapeHtml(fin.classe)}">
              ${escapeHtml(fin.texto)}
            </span>
          </div>

          <button
            type="button"
            class="tag-fav"
            aria-label="Favoritar imóvel"
          >♡</button>

          <div class="carousel-imgs">
            ${imgsHtml}
          </div>

          ${setasHtml}

        </div>

        <div class="card-body">

          <div class="card-price">
            ${escapeHtml(fmtPreco(imovel.preco))}
          </div>

          <div class="card-code">
            ${codigo}
          </div>

          <div class="card-title">
            ${titulo}
          </div>

          <div class="card-place">
            ${local}
          </div>

          ${
            specs.length
              ? `
                <div class="card-specs">
                  ${specs
                    .map(
                      spec => `<span>${spec}</span>`
                    )
                    .join("")}
                </div>
              `
              : ""
          }

        </div>

      </div>
    `;
  }

  window.cardHtml = cardHtml;

  // ------------------------------------------------------------
  // EVENTOS DOS CARDS
  // ------------------------------------------------------------

  if (!window.__paulinoCardEvents) {
    window.__paulinoCardEvents = true;

    document.addEventListener("click", function (event) {

      // --------------------------------------------------------
      // CARROSSEL — BOTÃO
      // --------------------------------------------------------

      const btnCarrossel =
        event.target.closest(".carousel-btn");

      if (btnCarrossel) {
        event.preventDefault();
        event.stopPropagation();

        const cardPhoto =
          btnCarrossel.closest(".card-photo");

        if (!cardPhoto) return;

        const imgs = [
          ...cardPhoto.querySelectorAll(
            ".carousel-imgs img"
          )
        ];

        const dots = [
          ...cardPhoto.querySelectorAll(
            ".carousel-dots .dot"
          )
        ];

        if (!imgs.length) return;

        let index = imgs.findIndex(img =>
          img.classList.contains("ativa")
        );

        if (index < 0) index = 0;

        if (btnCarrossel.classList.contains("next")) {
          index = (index + 1) % imgs.length;
        } else {
          index =
            (index - 1 + imgs.length) %
            imgs.length;
        }

        imgs.forEach((img, i) => {
          img.classList.toggle(
            "ativa",
            i === index
          );
        });

        dots.forEach((dot, i) => {
          dot.classList.toggle(
            "ativa",
            i === index
          );
        });

        return;
      }

      // --------------------------------------------------------
      // CARROSSEL — DOT
      // --------------------------------------------------------

      const dotCarrossel =
        event.target.closest(".carousel-dots .dot");

      if (dotCarrossel) {
        event.preventDefault();
        event.stopPropagation();

        const cardPhoto =
          dotCarrossel.closest(".card-photo");

        if (!cardPhoto) return;

        const dots = [
          ...cardPhoto.querySelectorAll(
            ".carousel-dots .dot"
          )
        ];

        const imgs = [
          ...cardPhoto.querySelectorAll(
            ".carousel-imgs img"
          )
        ];

        const index = dots.indexOf(dotCarrossel);

        if (index === -1) return;

        imgs.forEach((img, i) => {
          img.classList.toggle(
            "ativa",
            i === index
          );
        });

        dots.forEach((dot, i) => {
          dot.classList.toggle(
            "ativa",
            i === index
          );
        });

        return;
      }

      // --------------------------------------------------------
      // FAVORITO
      // --------------------------------------------------------

      const favorito =
        event.target.closest(".tag-fav");

      if (favorito) {
        event.preventDefault();
        event.stopPropagation();

        favorito.classList.toggle("ativo");

        return;
      }

      // --------------------------------------------------------
      // CARD
      // --------------------------------------------------------

      const card =
        event.target.closest(
          ".card[data-href]"
        );

      if (
        card &&
        card.dataset.href &&
        !event.defaultPrevented
      ) {
        window.location.href =
          card.dataset.href;
      }
    });
  }

  // ------------------------------------------------------------
  // BUSCAR IMÓVEIS
  // ------------------------------------------------------------

  async function buscarImoveis({
    finalidade,
    tipo,
    cidade,
    bairro,
    precoMin,
    precoMax,
    ordenarPorViews,
    limite
  } = {}) {

    let query = sb
      .from("imoveis")
      .select("*")
      .eq("disponivel", true);

    if (
      finalidade &&
      finalidade !== "Qualquer"
    ) {
      query = query.eq(
        "finalidade",
        finalidade
      );
    }

    if (
      tipo &&
      tipo !== "Qualquer"
    ) {
      query = query.eq(
        "tipo",
        tipo
      );
    }

    if (
      cidade &&
      cidade !== "Todas"
    ) {
      query = query.ilike(
        "cidade",
        `%${cidade}%`
      );
    }

    if (
      bairro &&
      bairro !== "Todos"
    ) {
      query = query.ilike(
        "bairro",
        `%${bairro}%`
      );
    }

    if (
      precoMin !== null &&
      precoMin !== undefined &&
      precoMin !== ""
    ) {
      query = query.gte(
        "preco",
        precoMin
      );
    }

    if (
      precoMax !== null &&
      precoMax !== undefined &&
      precoMax !== ""
    ) {
      query = query.lte(
        "preco",
        precoMax
      );
    }

    if (ordenarPorViews) {
      query = query
        .order("destaque_manual", {
          ascending: false
        })
        .order("visualizacoes", {
          ascending: false
        });
    } else {
      query = query.order(
        "criado_em",
        {
          ascending: false
        }
      );
    }

    if (
      limite !== null &&
      limite !== undefined
    ) {
      query = query.limit(limite);
    }

    const {
      data,
      error
    } = await query;

    if (error) {
      console.error(
        "Erro ao buscar imóveis:",
        error
      );

      return [];
    }

    return data || [];
  }

  window.buscarImoveis = buscarImoveis;

})();
