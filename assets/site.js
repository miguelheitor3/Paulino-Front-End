// Cliente Supabase compartilhado
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Formatação Monetária R$
function fmtPreco(v) {
  if (v == null || v === "") return "Sob consulta";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Formatação visual para inputs de preço à medida que digita
function aplicarMascaraMoeda(input) {
  input.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (!value) {
      e.target.value = "";
      return;
    }
    value = (parseInt(value, 10) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    e.target.value = "R$ " + value;
  });
}

function parseMoedaParaNumero(str) {
  if (!str) return null;
  const limpo = str.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(limpo) || null;
}

function urlFoto(caminho) {
  if (!caminho) return "https://via.placeholder.com/600x450?text=Sem+foto";
  const { data } = sb.storage.from("fotos-imoveis").getPublicUrl(caminho);
  return data.publicUrl;
}

function rotuloFinalidade(finalidade) {
  if (finalidade === "Alugar") return { texto: "Aluguel", classe: "aluguel" };
  if (finalidade === "Temporada") return { texto: "Temporada", classe: "temporada" };
  return { texto: "Venda", classe: "venda" };
}

function cardHtml(imovel, destaque) {
  const fotos = (imovel.fotos && imovel.fotos.length ? imovel.fotos : [null]).map(urlFoto);
  const specs = [];
  if (imovel.area_construida_m2) specs.push(`Const.: ${imovel.area_construida_m2} m²`);
  if (imovel.area_terreno_m2) specs.push(`Terr.: ${imovel.area_terreno_m2} m²`);
  if (imovel.quartos) specs.push(`${imovel.quartos} qts`);
  if (imovel.banheiros) specs.push(`${imovel.banheiros} ban.`);

  const fin = rotuloFinalidade(imovel.finalidade);

  const imgsHtml = fotos.map((f, i) =>
    `<img src="${f}" class="${i === 0 ? "ativa" : ""}" alt="${imovel.titulo}" loading="lazy">`
  ).join("");

  const setasHtml = fotos.length > 1 ? `
    <button type="button" class="carousel-btn prev" aria-label="Foto anterior">&#8249;</button>
    <button type="button" class="carousel-btn next" aria-label="Próxima foto">&#8250;</button>
    <div class="carousel-dots">${fotos.map((_, i) => `<span class="dot ${i === 0 ? "ativa" : ""}"></span>`).join("")}</div>
  ` : "";

  return `
    <div class="card" data-href="imovel.html?id=${imovel.id}" style="cursor: pointer;">
      <div class="card-photo">
        <div class="card-tags">
          ${destaque ? '<span class="tag-destaque">Destaque</span>' : ""}
          <span class="tag-finalidade ${fin.classe}">${fin.texto}</span>
        </div>
        <span class="tag-fav">♡</span>
        <div class="carousel-imgs">${imgsHtml}</div>
        ${setasHtml}
      </div>
      <div class="card-body">
        <div class="card-price">${fmtPreco(imovel.preco)}</div>
        <div class="card-code">${imovel.codigo ? "Código " + imovel.codigo : ""}</div>
        <div class="card-title">${imovel.titulo}</div>
        <div class="card-place">${[imovel.bairro, imovel.cidade].filter(Boolean).join(", ")}</div>
        ${specs.length ? `<div class="card-specs">${specs.map(s => `<span>${s}</span>`).join("")}</div>` : ""}
      </div>
    </div>`;
}

// Eventos dos cards (carrossel / clique)
document.addEventListener("click", (ev) => {
  const btnCarrossel = ev.target.closest(".carousel-btn");
  if (btnCarrossel) {
    ev.preventDefault();
    ev.stopPropagation();
    const cardPhoto = btnCarrossel.closest(".card-photo");
    const imgs = [...cardPhoto.querySelectorAll(".carousel-imgs img")];
    const dots = [...cardPhoto.querySelectorAll(".carousel-dots .dot")];
    let idx = imgs.findIndex(img => img.classList.contains("ativa"));
    idx = btnCarrossel.classList.contains("next") ? (idx + 1) % imgs.length : (idx - 1 + imgs.length) % imgs.length;
    imgs.forEach((img, i) => img.classList.toggle("ativa", i === idx));
    dots.forEach((d, i) => d.classList.toggle("ativa", i === idx));
    return;
  }

  const dotCarrossel = ev.target.closest(".carousel-dots .dot");
  if (dotCarrossel) {
    ev.preventDefault();
    ev.stopPropagation();
    const cardPhoto = dotCarrossel.closest(".card-photo");
    const dots = [...cardPhoto.querySelectorAll(".carousel-dots .dot")];
    const imgs = [...cardPhoto.querySelectorAll(".carousel-imgs img")];
    const idx = dots.indexOf(dotCarrossel);
    if (idx !== -1) {
      imgs.forEach((img, i) => img.classList.toggle("ativa", i === idx));
      dots.forEach((d, i) => d.classList.toggle("ativa", i === idx));
    }
    return;
  }

  const tagFav = ev.target.closest(".tag-fav");
  if (tagFav) {
    ev.preventDefault();
    ev.stopPropagation();
    tagFav.classList.toggle("ativo");
    return;
  }

  const card = ev.target.closest(".card[data-href]");
  if (card && card.dataset.href) {
    window.location.href = card.dataset.href;
  }
});

async function buscarImoveis({ finalidade, tipo, cidade, bairro, precoMin, precoMax, ordenarPorViews, limite } = {}) {
  let query = sb.from("imoveis").select("*").eq("disponivel", true);

  if (finalidade && finalidade !== "Qualquer") query = query.eq("finalidade", finalidade);
  if (tipo && tipo !== "Qualquer") query = query.eq("tipo", tipo);
  if (cidade && cidade !== "Todas") query = query.ilike("cidade", `%${cidade}%`);
  if (bairro && bairro !== "Todos") query = query.ilike("bairro", `%${bairro}%`);
  if (precoMin != null) query = query.gte("preco", precoMin);
  if (precoMax != null) query = query.lte("preco", precoMax);

  if (ordenarPorViews) {
    query = query.order("destaque_manual", { ascending: false }).order("visualizacoes", { ascending: false });
  } else {
    query = query.order("criado_em", { ascending: false });
  }
  if (limite) query = query.limit(limite);

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}
