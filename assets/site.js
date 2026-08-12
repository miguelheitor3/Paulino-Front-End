// Cliente Supabase compartilhado
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

function fmtPreco(v) {
  if (v == null) return "Sob consulta";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
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
  if (imovel.area_m2) specs.push(`${imovel.area_m2} m²`);
  if (imovel.quartos) specs.push(`${imovel.quartos} qts`);
  if (imovel.banheiros) specs.push(`${imovel.banheiros} ban.`);
  if (imovel.vagas) specs.push(`${imovel.vagas} vagas`);

  const fin = rotuloFinalidade(imovel.finalidade);

  const imgsHtml = fotos.map((f, i) =>
    `<img src="${f}" class="${i === 0 ? "ativa" : ""}" alt="${imovel.titulo}" loading="lazy">`
  ).join("");

  const setasHtml = fotos.length > 1 ? `
    <button type="button" class="carousel-btn prev" aria-label="Foto anterior" onclick="event.preventDefault(); event.stopPropagation();">&#8249;</button>
    <button type="button" class="carousel-btn next" aria-label="Próxima foto" onclick="event.preventDefault(); event.stopPropagation();">&#8250;</button>
    <div class="carousel-dots">${fotos.map((_, i) => `<span class="dot ${i === 0 ? "ativa" : ""}"></span>`).join("")}</div>
  ` : "";

  return `
    <a href="imovel.html?id=${imovel.id}" class="card" style="text-decoration: none; color: inherit; display: block;">
      <div class="card-photo">
        <div class="card-tags">
          ${destaque ? '<span class="tag-destaque">Destaque</span>' : ""}
          <span class="tag-finalidade ${fin.classe}">${fin.texto}</span>
        </div>
        <span class="tag-fav" onclick="event.preventDefault(); event.stopPropagation();">♡</span>
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
    </a>`;
}

// Delegação de eventos: funciona mesmo quando os cards são recriados dinamicamente.
// Precisa ser incluído uma vez em qualquer página que use cardHtml().
document.addEventListener("click", (ev) => {
  const btnCarrossel = ev.target.closest(".carousel-btn");
  if (btnCarrossel) {
    ev.preventDefault();
    ev.stopPropagation();
    const cardPhoto = btnCarrossel.closest(".card-photo");
    const imgs = [...cardPhoto.querySelectorAll(".carousel-imgs img")];
    const dots = [...cardPhoto.querySelectorAll(".carousel-dots .dot")];
    let idx = imgs.findIndex(img => img.classList.contains("ativa"));
    idx = btnCarrossel.classList.contains("next")
      ? (idx + 1) % imgs.length
      : (idx - 1 + imgs.length) % imgs.length;
    imgs.forEach((img, i) => img.classList.toggle("ativa", i === idx));
    dots.forEach((d, i) => d.classList.toggle("ativa", i === idx));
    return;
  }

  const card = ev.target.closest(".card[data-href]");
  if (card) {
    window.location.href = card.dataset.href;
  }
});

// Busca imóveis disponíveis aplicando os filtros passados (todos opcionais)
async function buscarImoveis({ finalidade, tipo, cidade, bairro, quartosMin, precoMin, precoMax, ordenarPorViews, limite } = {}) {
  let query = sb.from("imoveis").select("*").eq("disponivel", true);

  if (finalidade && finalidade !== "Qualquer") query = query.eq("finalidade", finalidade);
  if (tipo && tipo !== "Qualquer") query = query.eq("tipo", tipo);
  if (cidade && cidade !== "Todas") query = query.eq("cidade", cidade);
  if (bairro && bairro !== "Todos") query = query.eq("bairro", bairro);
  if (quartosMin) query = query.gte("quartos", quartosMin);
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

// Preenche um <select> com valores distintos de uma coluna, mantendo a primeira opção ("Todas"/"Todos")
async function preencherSelectDistintos(selectEl, coluna) {
  const { data, error } = await sb.from("imoveis").select(coluna).eq("disponivel", true);
  if (error || !data) return;
  const valores = [...new Set(data.map(r => r[coluna]).filter(Boolean))].sort();
  const primeira = selectEl.options[0];
  selectEl.innerHTML = "";
  selectEl.appendChild(primeira);
  valores.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}
