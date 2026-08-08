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

function cardHtml(imovel, destaque) {
  const foto = urlFoto(imovel.fotos && imovel.fotos[0]);
  const specs = [];
  if (imovel.area_m2) specs.push(`${imovel.area_m2} m²`);
  if (imovel.quartos) specs.push(`${imovel.quartos} qts`);
  if (imovel.banheiros) specs.push(`${imovel.banheiros} ban.`);
  if (imovel.vagas) specs.push(`${imovel.vagas} vagas`);

  return `
    <a class="card" href="imovel.html?id=${imovel.id}">
      <div class="card-photo">
        ${destaque ? '<span class="tag-destaque">Destaque</span>' : ""}
        <span class="tag-fav">♡</span>
        <img src="${foto}" alt="${imovel.titulo}" loading="lazy">
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
