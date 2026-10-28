// Controle da página: formulário → back-end PHP → lista e mapa → detalhe da unidade → tabela de profissionais da unidade.
const PAGINAS_POR_CLIQUE = 3;                     // 3 × 20 = 60 itens por clique
const estado = { municipios: [], tipos: new Map(), codigo: "", tipo: "", itens: [], vistos: new Set(), pagina: 0, fim: true, filtro: "",
                 sel: null, prof: "", achados: new Map(), varridos: new Set(), demo: false, profs: [], profPag: 0, profFim: true, ocup: "", servicos: [], token: 0, variante: 0, fonte: "cnes" };

function aviso(msg, erro = false) { const a = $("aviso"); a.textContent = msg; a.className = erro ? "erro" : ""; }
const iconeDe = e => (/hospital|pronto|upa|maternidade/i.test(e.nome) ? "i-hospital" : "i-ubs");
function linha(dl, rotulo, valor) { if (valor !== "" && valor != null) dl.append(el("dt", rotulo), el("dd", String(valor))); }

// ---------- municípios (todos os 217 ficam na lista; o campo só filtra) ----------
function preencherMunicipios(filtro = "") {
  const sel = $("municipio"); sel.replaceChildren();
  const lista = estado.municipios.filter(m => semAcento(m.nome).includes(semAcento(filtro)));
  const primeiro = el("option", lista.length ? "Selecione o município (" + lista.length + ")" : "Nenhum município encontrado");
  primeiro.value = ""; sel.appendChild(primeiro);
  for (const m of lista) { const o = el("option", m.nome); o.value = m.codigo; sel.appendChild(o); }
  if (filtro.trim() && lista.length === 1) sel.value = lista[0].codigo;   // um só resultado: já seleciona
}

async function iniciar() {
  try {
    estado.municipios = await listarMunicipiosMA();
    $("qtd-municipios").textContent = "(" + estado.municipios.length + " no Maranhão)";
  } catch (erro) {
    estado.municipios = [{ nome: "São Luís", codigo: "211130" }];
    aviso("Não consegui carregar os municípios: " + erro.message + ".", true);
  }
  preencherMunicipios();
  montarAtalhos();
  try {
    const tipos = await listarTipos();
    for (const t of tipos) { estado.tipos.set(String(t.codigo), t.nome); const o = el("option", t.nome); o.value = t.codigo; $("tipo").appendChild(o); }
    $("bloco-tipo").hidden = tipos.length === 0;
  } catch { /* sem filtro de tipo: o app segue funcionando */ }
}

const ATALHOS = ["São Luís", "Imperatriz", "Timon", "Caxias", "Codó", "Paço do Lumiar", "São José de Ribamar", "Bacabal"];
function montarAtalhos() {
  const box = $("atalhos"); box.replaceChildren();
  for (const nome of ATALHOS) {
    const m = estado.municipios.find(x => semAcento(x.nome) === semAcento(nome)); if (!m) continue;
    const b = el("button", nome); b.type = "button";
    b.addEventListener("click", () => { $("filtro-municipio").value = ""; preencherMunicipios(); $("municipio").value = m.codigo; buscar(false); });
    box.appendChild(b);
  }
  $("atalhos").parentElement.hidden = !box.children.length;
}
// Filtra a lista já carregada enquanto o usuário digita (nome, razão social, CNES, CNPJ, endereço).
$("nome-unidade").addEventListener("input", () => { if (estado.itens.length) { estado.nome = $("nome-unidade").value.trim(); desenhar(true); } });
// Limpar em dois passos: 1º tira os filtros (gestão, tipo, busca, profissional) e volta a mostrar TODAS as unidades do município
// no mapa e na lista; se já não houver filtro, limpa também o município e volta ao mapa geral do Maranhão.
const filtrosAtivos = () => !!(estado.filtro || estado.tipo || estado.nome || estado.prof || $("nome-unidade").value || $("nome-profissional").value || $("gestao").value || $("tipo").value);
function limparBusca() {
  const temFiltro = filtrosAtivos(), temResultado = estado.itens.length > 0;
  $("nome-unidade").value = ""; $("nome-profissional").value = ""; $("gestao").value = ""; $("tipo").value = "";
  Object.assign(estado, { filtro: "", tipo: "", nome: "", prof: "", achados: new Map(), avisoProf: "" }); estado.token++;
  aviso("");
  if (!$("vista-detalhe").hidden) { $("vista-detalhe").hidden = true; $("vista-lista").hidden = false; $("secao-prof").hidden = true; }
  if (temResultado && temFiltro) { desenhar(true); return; }          // passo 1: todas as unidades do município
  tokenLoc++;                                                         // passo 2: reinicia tudo
  Object.assign(estado, { codigo: "", itens: [], vistos: new Set(), pagina: 0, fim: true, demo: false, fonte: "cnes", sel: null });
  $("filtro-municipio").value = ""; preencherMunicipios();
  desenhar(false); desenharPontos([], abrirDetalhe, false); mapa.fitBounds(LIMITES_MA, { padding: [10, 10] });
}
// Gestão e tipo filtram ao vivo o que já foi carregado (mapa e lista).
$("gestao").addEventListener("change", () => { estado.filtro = $("gestao").value; if (estado.itens.length) desenhar(true); });
$("tipo").addEventListener("change", () => { estado.tipo = $("tipo").value; if (estado.itens.length) desenhar(true); });

// ---------- estabelecimentos ----------
async function carregarPaginas(n) {
  for (let i = 0; i < n && !estado.fim; i++) {
    const r = estado.demo
      ? { itens: DEMO.estabelecimentos.map(normalizarEstab), cheia: false }
      : await buscarEstabelecimentos(estado.codigo, "", estado.pagina);   // o tipo filtra ao vivo (visiveis)
    estado.pagina++;
    for (const [c, n] of tiposPortal) if (!estado.tipos.has(c)) estado.tipos.set(c, n);
    const sel = $("tipo");   // completa o filtro de tipo com os tipos que o portal informou
    for (const [c, n] of [...tiposPortal].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")))
      if (![...sel.options].some(o => o.value === c)) { const o = el("option", n); o.value = c; sel.appendChild(o); $("bloco-tipo").hidden = false; }
    const novos = r.itens.filter(e => !estado.vistos.has(e.cnes));
    novos.forEach(e => { estado.vistos.add(e.cnes); estado.itens.push(e); });
    if (!novos.length || !r.cheia) estado.fim = true;
  }
  if (!estado.demo && estado.fonte === "cnes") localizarLote();
}

// Põe TODAS as unidades do município no mapa. Fase 1: coordenadas oficiais da ficha do CNES (6 ao mesmo tempo).
// Fase 2: quem não tem coordenada oficial é localizado pelo endereço (1 por segundo). O mapa vai enchendo sem "pular".
let tokenLoc = 0;
async function localizarLote() {
  const tk = ++tokenLoc, todas = estado.itens.filter(e => !temCoordenada(e));
  if (!todas.length) return;
  const ativo = () => tk === tokenLoc && !estado.demo;
  const emLista = () => $("vista-detalhe").hidden;
  const redesenhar = fim => { if (!emLista()) return; desenharPontos(visiveis(), abrirDetalhe, fim); desenharResumo(); };
  let feitos = 0, achou = 0, fitou = false;
  const progresso = txt => { if (!$("aviso").className) aviso(txt + " " + feitos + " de " + todas.length); };
  const achar = () => { achou++; if (achou === 1 || achou % 10 === 0) { redesenhar(!fitou); fitou = true; } };

  const fila1 = [...todas];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (fila1.length && ativo()) { const e = fila1.shift(); if (!estado.demo) await fichaDe(e, estado.codigo); const ok1 = await localizarOficial(e, estado.codigo); if (e.ficha) atualizarSelosHorario(e); if (ok1) achar(); feitos++; progresso("Colocando as unidades no mapa…"); }
  }));
  if (!ativo()) return;
  redesenhar(true); fitou = true;

  const fila2 = todas.filter(e => !temCoordenada(e)); feitos = 0; todas.length = 0; todas.push(...fila2);
  for (const e of fila2) {
    if (!ativo()) return;
    if (await localizarPorEndereco(e, nomeMunicipioAtual(), estado.codigo)) achar();
    feitos++; progresso("Localizando pelo endereço as que faltam…");
  }
  if (!ativo()) return;
  if (!$("aviso").className) aviso("");
  if (fila2.length) redesenhar(true);
}

async function buscar(maisUm) {
  if (!maisUm) {
    if (!$("municipio").value) return aviso("Escolha um município na lista.", true);
    Object.assign(estado, { codigo: $("municipio").value, tipo: $("tipo").value, itens: [], vistos: new Set(), pagina: 0, fim: false, filtro: $("gestao").value, nome: $("nome-unidade").value.trim(), prof: $("nome-profissional").value.trim(), achados: new Map(), varridos: new Set(), demo: false, fonte: "cnes" });
    $("secao-prof").hidden = true;
  }
  $("btn-buscar").disabled = $("btn-mais").disabled = true; aviso("Buscando no CNES…");
  try { await carregarPaginas(PAGINAS_POR_CLIQUE); aviso(""); }
  catch (erro) {
    if (estado.itens.length) aviso("Falha ao carregar mais: " + erro.message + ".", true);
    else {   // Plano B: 1) OpenStreetMap (dados reais, sem profissionais)  2) demonstração
      const nome = (estado.municipios.find(m => m.codigo === estado.codigo) || {}).nome || "";
      try {
        aviso("API do CNES indisponível. Buscando as unidades no OpenStreetMap…");
        const lista = await buscarEstabOSM(nome, estado.codigo);
        if (!lista.length) throw new Error("nenhuma unidade encontrada para " + nome);
        for (const [c, n] of Object.entries(TIPOS_OSM)) estado.tipos.set(c, n);
        lista.forEach(e => { estado.vistos.add(e.cnes); estado.itens.push(e); });
        Object.assign(estado, { fonte: "osm", fim: true });
        aviso("A API do CNES não respondeu (" + erro.message + "). Mostrando unidades do OpenStreetMap: sem profissionais, leitos e serviços, que só existem no CNES.", true);
      } catch (e2) {
        Object.assign(estado, { demo: true, pagina: 0, fim: false, vistos: new Set(), itens: [] });
        await carregarPaginas(1);
        aviso("Sem acesso à API do CNES (" + erro.message + ") nem ao OpenStreetMap (" + e2.message + "). Exibindo dados de DEMONSTRAÇÃO.", true);
      }
    }
  }
  if (estado.prof && estado.itens.length) await varrerProfissionais();
  $("btn-buscar").disabled = $("btn-mais").disabled = false;
  if (!estado.itens.length && !$("aviso").className) aviso("Nenhum estabelecimento ativo encontrado com esses filtros.");
  desenhar(true);
}

// ---------- busca pelo nome do profissional ----------
// A API não permite buscar pessoa em todo o município; então olhamos a lista de profissionais de cada unidade
// carregada (portal do CNES, 1 consulta por unidade, poucas ao mesmo tempo) e guardamos onde o nome aparece.
async function varrerProfissionais() {
  const q = semAcento(estado.prof), token = ++estado.token;
  if (estado.demo || estado.fonte === "osm") { aviso("A busca por profissional precisa dos dados do CNES, que não estão disponíveis agora.", true); return; }
  const fila = estado.itens.filter(e => !estado.varridos.has(e.cnes));
  let feitos = 0, semNome = 0, falhas = 0;
  const trabalhador = async () => {
    while (fila.length && token === estado.token) {
      const e = fila.shift();
      try {
        const sete = String(parseInt(e.cnes, 10)).padStart(7, "0");
        const r = await buscarProfissionais({}, 0, "/portal/profissionais/" + String(estado.codigo).slice(0, 6) + sete, e.cnes);
        const casam = r.itens.filter(x => !x.semNome && semAcento(x.titulo).includes(q));
        if (r.itens.length && r.itens.every(x => x.semNome)) semNome++;
        if (casam.length) estado.achados.set(e.cnes, casam);
        estado.varridos.add(e.cnes);
      } catch { falhas++; }
      feitos++; aviso("Procurando “" + estado.prof + "” nas unidades… " + feitos + " de " + (feitos + fila.length));
    }
  };
  await Promise.all(Array.from({ length: 5 }, trabalhador));
  if (token !== estado.token) return;
  const n = estado.achados.size;
  estado.avisoProf = n ? n + (n === 1 ? " unidade tem" : " unidades têm") + " profissional com “" + estado.prof + "” no nome."
    : "Nenhum profissional com “" + estado.prof + "” nas " + estado.varridos.size + " unidades verificadas" + (estado.fim ? "." : ". Use “Carregar mais estabelecimentos” para ampliar a busca.")
      + (semNome ? " (O CNES não informa o nome dos profissionais de algumas unidades.)" : "");
  aviso(estado.avisoProf + (falhas ? " " + falhas + " unidade(s) não responderam." : ""), !n && falhas > 0);
}

// ---------- resumo do município com gráficos ----------
function desenharResumo() {
  const box = $("resumo-mun"); box.replaceChildren();
  const itens = estado.itens; box.hidden = !itens.length; if (!itens.length) return;
  const cont = k => itens.filter(e => e.gestao === k).length;
  const comMapa = itens.filter(temCoordenada).length;
  const nomeTipo = e => estado.tipos.get(e.tipoCodigo) || (estado.demo ? "Exemplo" : "Tipo " + (e.tipoCodigo || "n/i"));
  const porTipo = new Map(); itens.forEach(e => porTipo.set(nomeTipo(e), (porTipo.get(nomeTipo(e)) || 0) + 1));
  const hosp = itens.filter(e => simNao(campo(e.bruto, "estabelecimento_possui_atendimento_hospitalar")) || /hospital|maternidade/i.test(e.nome)).length;
  const faixa = el("div", null, "kpis");
  faixa.append(indicador("Unidades ativas", itens.length + (estado.fim ? "" : "+"), estado.fim ? "todas carregadas" : "há mais para carregar"),
               indicador("No mapa", comMapa, Math.round(comMapa / itens.length * 100) + "% com coordenadas"),
               indicador("Hospitalares", hosp, "com internação"));
  const graf = el("div", null, "graficos");
  graf.append(cartaoGrafico("Gestão", rosca([["E", "Estadual"], ["M", "Municipal"], ["D", "Dupla"], ["?", "Não informada"]].map(([k, r]) => ({ rotulo: r, valor: cont(k), cor: COR[k] })), { numero: itens.length, texto: "unidades" })),
             cartaoGrafico("Principais tipos de unidade", barras([...porTipo].map(([rotulo, valor]) => ({ rotulo, valor })), { max: 6, cor: "var(--verde)" })));
  box.append(faixa, graf);
}

const visiveis = () => {
  const q = semAcento(estado.nome || ""), qd = q.replace(/\D/g, "");
  // Como no portal do CNES: casa nome fantasia, nome empresarial, CNES, CNPJ e endereço.
  const casa = e => {
    const empresarial = campo(e.bruto, "noEmpresarial", "rzSocial", "nome_razao_social", "razao_social"), cnpj = String(campo(e.bruto, "cnpj", "numero_cnpj_entidade")).replace(/\D/g, "");
    return semAcento([e.nome, empresarial, e.cnes, e.endereco].join(" ")).includes(q) || (qd.length >= 3 && (cnpj.includes(qd) || e.cnes.replace(/^0+/, "").includes(qd.replace(/^0+/, ""))));
  };
  const tipoOk = e => !estado.tipo || estado.demo || estado.fonte === "osm" || String(e.tipoCodigo) === String(estado.tipo);
  return estado.itens.filter(e => (!estado.filtro || e.gestao === estado.filtro) && tipoOk(e) && (!q || casa(e))
    && (!estado.prof || estado.achados.has(e.cnes)));
};
const nomeMunicipioAtual = () => (estado.municipios.find(m => m.codigo === estado.codigo) || {}).nome || "";

function desenhar(ajustarMapa) {
  const f = $("filtros"); f.replaceChildren();
  const cont = k => estado.itens.filter(e => e.gestao === k).length;
  for (const [k, nome, n] of [["", "Todas", estado.itens.length], ["E", "Estadual", cont("E")], ["M", "Municipal", cont("M")], ["D", "Dupla", cont("D")], ["?", "Não informada", cont("?")]]) {
    if (k === "?" && !n) continue;
    const b = el("button", nome + " (" + n + ")"); b.type = "button"; b.setAttribute("aria-pressed", String(estado.filtro === k));
    b.addEventListener("click", () => { estado.filtro = k; $("gestao").value = k; desenhar(true); });
    f.appendChild(b);
  }
  f.hidden = !estado.itens.length; $("btn-mais").hidden = estado.fim;
  const ul = $("resultados"); ul.replaceChildren();
  for (const e of visiveis()) {
    const li = document.createElement("li"); const b = el("button", null, "item"); b.type = "button";
    const t = el("span"); t.append(el("strong", e.nome), el("small", NOME_GESTAO[e.gestao].split(" (")[0] + " · CNES " + e.cnes));
    const c = complexidadeDe(e, estado.tipos.get(e.tipoCodigo)), h = horarioDe(e);
    const sel = el("span", null, "selos-card");
    const sc = el("span", c.nivel ? "Complexidade " + c.curto.toLowerCase() : "", "selo-c " + c.nivel); sc.dataset.cnes = e.cnes; sc.hidden = !c.nivel; sel.append(sc);
    const sh = el("span", (h.h24 ? "● " : "🕒 ") + h.curto, "selo-h" + (h.h24 ? " h24" : "")); sh.dataset.cnes = e.cnes; sel.append(sh);
    t.append(sel);
    const ach = estado.prof && estado.achados.get(e.cnes);
    if (ach) { const nomes = ach.slice(0, 3).map(x => x.titulo + (x.ocupacao && x.ocupacao !== "Não informada" ? " (" + x.ocupacao + ")" : "")).join("; "); t.append(el("small", "👤 " + nomes + (ach.length > 3 ? " +" + (ach.length - 3) : ""), "achado-prof")); }
    const mini = el("span", null, "mini-foto " + e.gestao); mini.append(icone(iconeDe(e), "ico " + e.gestao));
    b.append(mini, t);
    miniFoto(e, mini);
    b.addEventListener("click", () => abrirDetalhe(e));
    li.appendChild(b); ul.appendChild(li);
  }
  desenharResumo();
  atualizarLegenda(estado.itens, nomeMunicipioAtual(), estado.filtro);
  if (estado.itens.length && estado.nome && !estado.prof && !$("aviso").className) aviso(visiveis().length + " de " + estado.itens.length + " unidades contêm “" + estado.nome + "”.");
  if (ajustarMapa) desenharPontos(visiveis(), abrirDetalhe);
}

// ---------- dados da unidade com nomes legíveis ----------
function grupoDl(titulo, pares) {
  const itens = pares.filter(([, v]) => v !== "" && v != null && v !== false);
  if (!itens.length) return null;
  const sec = el("section", null, "grupo"); sec.appendChild(el("h4", titulo));
  const dl = document.createElement("dl"); itens.forEach(([k, v]) => linha(dl, k, v)); sec.appendChild(dl); return sec;
}
function montarSecoes(e) {
  const b = e.bruto, box = $("det-secoes"); box.replaceChildren();
  const codMun = String(campo(b, "codigo_municipio")).slice(0, 6);
  const municipio = (estado.municipios.find(m => m.codigo === codMun) || {}).nome || "";
  const tem = k => k in b && b[k] !== "" && b[k] != null;
  const num = campo(b, "numero_estabelecimento", "numero"), rua = campo(b, "endereco_estabelecimento", "logradouro");
  const cnpj = campo(b, "numero_cnpj_entidade", "numero_cnpj");
  const natur = String(campo(b, "descricao_natureza_juridica_estabelecimento", "natureza_juridica"));
  const ensino = String(campo(b, "codigo_atividade_ensino_unidade"));
  const grupos = [
    grupoDl("Identificação", [["Razão social", campo(b, "nome_razao_social", "razao_social")], ["Código CNES", e.cnes], ["CNPJ", cnpj && formatarCnpj(cnpj)],
      ["Tipo de unidade", estado.tipos.get(e.tipoCodigo)], ["Esfera administrativa", frase(campo(b, "descricao_esfera_administrativa", "esfera_administrativa"))],
      ["Natureza jurídica", NATUREZA[natur] || (natur ? "Código " + natur : "")]]),
    grupoDl("Endereço e contato", [["Endereço", [rua, num].filter(Boolean).join(", ")], ["Bairro", campo(b, "bairro_estabelecimento", "bairro")], ["Município", municipio],
      ["CEP", campo(b, "codigo_cep_estabelecimento", "cep") && formatarCep(campo(b, "codigo_cep_estabelecimento", "cep"))], ["Telefone", e.telefone], ["E-mail", e.email]]),
    grupoDl("Funcionamento", [["Atendimento ambulatorial pelo SUS", tem("estabelecimento_faz_atendimento_ambulatorial_sus") ? (simNao(b.estabelecimento_faz_atendimento_ambulatorial_sus) ? "Sim" : "Não") : ""],
      ["Atividade de ensino", ENSINO[ensino] || ""], ["Cadastro atualizado em", campo(b, "data_atualizacao") && formatarDataIso(campo(b, "data_atualizacao"))]]),
  ];
  grupos.filter(Boolean).forEach(g => box.appendChild(g));
  const estrutura = [["estabelecimento_possui_atendimento_hospitalar", "Atendimento hospitalar"], ["estabelecimento_possui_atendimento_ambulatorial", "Atendimento ambulatorial"],
    ["estabelecimento_possui_centro_cirurgico", "Centro cirúrgico"], ["estabelecimento_possui_centro_obstetrico", "Centro obstétrico"],
    ["estabelecimento_possui_centro_neonatal", "Centro neonatal"], ["estabelecimento_possui_servico_apoio", "Serviço de apoio (diagnóstico e terapia)"]].filter(([k]) => tem(k));
  if (estrutura.length) {
    const sec = el("section", null, "grupo"); sec.appendChild(el("h4", "Estrutura da unidade"));
    const ul = el("ul", null, "estrutura");
    for (const [k, nome] of estrutura) { const sim = simNao(b[k]); ul.appendChild(el("li", (sim ? "✓ " : "✗ ") + nome, sim ? "sim" : "nao")); }
    sec.appendChild(ul); box.appendChild(sec);
  }
}

// Diagnóstico: mostra o que a API respondeu quando a lista de serviços ou de profissionais fica vazia ou falha.
function mostrarDiag() {
  const itens = DIAG.filter(d => /(profissionais|servicos|leitos)/.test(d.rota)).slice(-8);
  $("diag").hidden = !itens.length;
  $("diag-txt").textContent = itens.map(d => `${d.rota.split("/").pop()} · ${Object.entries(d.params).filter(([k]) => k !== "rota").map(([k, v]) => k + "=" + v).join("&")}\n  → ${d.status} em ${d.ms} ms · ${d.trecho || "(sem corpo)"}`).join("\n\n");
}

// ---------- foto do estabelecimento ----------
async function carregarFoto(e, token) {
  const img = $("foto-img"), vazia = $("foto-vazia"), leg = $("foto-leg");
  img.hidden = true; vazia.hidden = false; leg.replaceChildren();
  $("foto-msg").textContent = "Procurando foto…";
  $("foto-ico").setAttribute("href", "img/simbolos.svg#" + iconeDe(e));
  const f = await buscarFoto(e).catch(() => null);
  if (token !== estado.token) return;                           // o usuário já abriu outra unidade
  if (!f) { $("foto-msg").textContent = "Sem foto pública deste estabelecimento. Use “Ver fachada” para conferir no Street View."; return; }
  img.onload = () => { img.hidden = false; vazia.hidden = true; };
  img.onerror = () => { $("foto-msg").textContent = "Não consegui carregar a foto."; };
  img.src = f.url; img.alt = "Foto: " + f.titulo;
  const a = el("a", "Wikimedia Commons"); a.href = f.pagina; a.target = "_blank"; a.rel = "noopener";
  leg.append(f.tipo === "proxima" ? "Foto próxima ao local (pode não ser a fachada) · " : "Foto: ", a);
}

// ---------- detalhe de um estabelecimento ----------
function escolherAba(nome) {
  document.querySelectorAll("#abas-det button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.aba === nome)));
  ["prof", "serv", "dados"].forEach(n => { $("aba-" + n).hidden = n !== nome; });
}
document.querySelectorAll("#abas-det button").forEach(b => b.addEventListener("click", () => escolherAba(b.dataset.aba)));

// Links de rota/rua e aviso de localização da unidade aberta.
function mostrarLocal(e) {
  const gm = $("link-gmaps"), sv = $("link-street"), tem = temCoordenada(e);
  gm.hidden = sv.hidden = !tem;
  if (tem) {
    gm.href = "https://www.google.com/maps/dir/?api=1&destination=" + e.lat + "," + e.lng;
    sv.href = "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + e.lat + "," + e.lng;
  }
  $("det-rota").textContent = tem ? (e.aprox ? "Localização aproximada (pelo bairro/CEP): o CNES não informou as coordenadas." : "")
    : "Não consegui localizar este endereço no mapa.";
}

function abrirDetalhe(e) {
  escolherAba("prof"); $("qtd-prof").textContent = "";
  estado.sel = e; estado.token++; const token = estado.token;
  estado.profs = []; estado.profPag = 0; estado.profFim = false; estado.ocup = ""; estado.servicos = []; estado.variante = 0; $("diag").hidden = true;
  $("vista-lista").hidden = true; $("vista-detalhe").hidden = false;
  $("det-nome").textContent = e.nome; $("det-nome").focus();
  const g = $("det-gestao"); g.textContent = NOME_GESTAO[e.gestao]; g.className = "selo " + e.gestao;
  mostrarComplexidade(e);
  $("det-orgao").textContent = orgaoDe(e.gestao, nomeMunicipioAtual());
  mostrarHorario(e);
  if (!e.ficha && !estado.demo && e.fonte !== "osm") fichaDe(e, estado.codigo).then(f => { if (f) atualizarSelosHorario(e); if (estado.sel === e && token === estado.token) { mostrarHorario(e); mostrarComplexidade(e); if (f) montarSecoes(e); } });
  montarSecoes(e);
  mostrarLocal(e);
  const cn = $("link-cnes"), mun6 = (String(campo(e.bruto, "codigo_municipio")).slice(0, 6) || estado.codigo), sete = String(parseInt(e.cnes, 10) || 0).padStart(7, "0");
  cn.hidden = estado.demo || e.fonte === "osm" || !mun6; cn.href = "https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/identificacao/" + mun6 + sete;
  $("det-situacao").hidden = estado.demo || e.fonte === "osm";
  destacar(e);
  if (!temCoordenada(e) && !estado.demo && e.fonte !== "osm") {
    $("det-rota").textContent = "Localizando pelo endereço…";
    localizarPorEndereco(e, nomeMunicipioAtual(), estado.codigo).then(ok => {
      if (estado.sel !== e || token !== estado.token) return;
      mostrarLocal(e);
      if (ok) { desenharPontos(visiveis(), abrirDetalhe); destacar(e); }
    });
  }
  carregarFoto(e, token);
  if (e.fonte === "osm") return semDadosCnes(e);
  carregarServicos(token);
  abrirSecaoProfissionais(token);
}

// Unidade vinda do OpenStreetMap (CNES fora do ar): profissionais, serviços e leitos só existem no CNES.
function semDadosCnes(e) {
  const txt = "Profissionais, serviços e leitos vêm do CNES, que não respondeu nesta busca. Tente buscar de novo mais tarde; os dados abaixo (nome, endereço, contato) vêm do OpenStreetMap.";
  $("secao-prof").hidden = false; $("tit-prof").textContent = "Profissionais de saúde · " + e.nome;
  $("graf-prof").hidden = true; $("fer-prof").hidden = true; $("vazio-prof").hidden = true; $("corpo-prof").replaceChildren(); $("corpo-prof").hidden = false;
  $("btn-mais-prof").hidden = $("btn-tudo-prof").hidden = true; $("diag").hidden = true;
  $("msg-prof").className = "nota"; $("msg-prof").textContent = txt; $("prof-turno").textContent = turnoDe(e) || "não informado";
  $("leitos").hidden = true; $("lista-servicos").replaceChildren(); $("msg-servicos").className = "nota"; $("msg-servicos").textContent = txt; $("qtd-serv").textContent = "";
}

// ---------- serviços oferecidos ----------
// Leitos: total, leitos SUS e quantidade por especialidade/tipo, no topo da aba Serviços.
async function carregarLeitos(token) {
  const box = $("leitos"); box.replaceChildren(); box.hidden = true;
  let leitos = [];
  try { leitos = estado.demo ? DEMO.leitos.map(normalizarLeito) : await buscarLeitos(estado.sel, estado.codigo); }
  catch { mostrarDiag(); return; }
  if (token !== estado.token) return;
  if (!leitos.length) {
    box.append(el("h4", "Leitos"), el("p", "Nenhum leito registrado na base pública para este estabelecimento (CNES " + estado.sel.cnes + ").", "nota")); box.hidden = false; return;
  }
  const soma = k => leitos.reduce((t, l) => t + (Number.isFinite(l[k]) ? l[k] : 0), 0);
  const total = soma("total"), sus = soma("sus");
  const faixa = el("div", null, "faixa-info leitos-resumo");
  const tile = (rot, val) => { const d = el("div"); d.append(el("small", rot), el("strong", String(val))); faixa.appendChild(d); };
  if (total) tile("Leitos existentes", total);
  if (sus) tile("Leitos SUS", sus);
  tile("Especialidades de leito", new Set(leitos.map(l => l.nome).filter(Boolean)).size || leitos.length);
  box.append(el("h4", "Leitos"), faixa);
  const ul = el("ul", null, "leitos-lista");
  const maior = Math.max(1, ...leitos.map(x => x.total || 0));
  for (const l of [...leitos].sort((x, y) => (y.total || 0) - (x.total || 0))) {
    const li = el("li"), d = el("details");
    const sm = el("summary"); sm.append(el("span", l.nome || "Leito (sem descrição)", "leito-nome"), el("strong", Number.isFinite(l.total) ? String(l.total) : "—"));
    d.appendChild(sm);
    if (Number.isFinite(l.total)) { const b = el("div", null, "carga"); const i2 = el("i"); i2.style.width = Math.max(4, l.total / maior * 100) + "%"; b.appendChild(i2); d.appendChild(b); }
    const dl = document.createElement("dl");
    for (const [k, v] of Object.entries(l.bruto)) if (!OCULTOS.test(k)) linha(dl, humanizar(k), v);
    d.appendChild(dl); li.appendChild(d); ul.appendChild(li);
  }
  box.appendChild(ul); box.hidden = false;
  $("qtd-serv").textContent = total ? "(" + total + " leitos)" : $("qtd-serv").textContent;
}

async function carregarServicos(token) {
  carregarLeitos(token);
  const ul = $("lista-servicos"), msg = $("msg-servicos"); ul.replaceChildren(); $("qtd-serv").textContent = "";
  msg.className = "nota"; msg.textContent = "Carregando serviços…";
  try {
    let pag = 0, cheia = true; const todos = [];
    while (cheia && pag < 5) {                                // até 100 serviços
      const r = estado.demo ? { itens: DEMO.servicos.map(normalizarServico), cheia: false } : await buscarServicos(estado.sel.cnes, pag);
      todos.push(...r.itens); cheia = r.cheia; pag++;
    }
    if (token !== estado.token) return;
    estado.servicos = todos;
    // agrupa por nome do serviço, juntando as classificações
    const grupos = new Map();
    for (const s of todos) { const g = grupos.get(s.nome) || new Set(); if (s.classe) g.add(s.classe); grupos.set(s.nome, g); }
    msg.textContent = grupos.size ? "" : "Nenhum serviço especializado devolvido pela API para esta unidade.";
    if (!grupos.size) mostrarDiag();
    if (!$("leitos").childElementCount) $("qtd-serv").textContent = grupos.size ? "(" + grupos.size + ")" : "";
    for (const [nome, classes] of grupos) {
      const li = el("li"); li.append(el("strong", nome));
      if (classes.size) li.append(el("small", [...classes].join(" · ")));
      ul.appendChild(li);
    }
    if (estado.profs.length) desenharProfs();                 // atualiza a coluna "Serviço oferecido"
  } catch (erro) {
    if (token !== estado.token) return;
    msg.className = "nota erro"; msg.textContent = "Não foi possível carregar os serviços: " + erro.message + "."; mostrarDiag();
  }
}

// ---------- tabela de profissionais da unidade ----------
const iniciaisDe = p => (p.semNome ? p.ocupacao : p.titulo).trim().split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "P";
const classeVinculo = v => { const t = semAcento(v); return /estatut/.test(t) ? "estatutario" : /celet|clt/.test(t) ? "celetista" : /(contrat|tempor|cargo comiss|comiss)/.test(t) ? "contratado" : "outro"; };

// Cartão de um profissional: só mostra o que o CNES realmente informa (nome, ocupação, CBO, vínculo, carga horária).
function cartaoProf(p) {
  const art = el("article", null, "cartao-prof");
  const topo = el("div", null, "cp-topo"), txt = el("div");
  txt.append(el("h4", p.semNome ? "Profissional de saúde" : p.titulo));
  txt.append(el("p", p.semNome ? "Nome não divulgado na base pública" : p.ocupacao, p.semNome ? "cp-sub suave" : "cp-sub"));
  topo.append(el("span", iniciaisDe(p), "avatar-prof"), txt);
  const dados = el("dl", null, "cp-dados");
  const cbo = campo(p.bruto, "codigo_cbo", "cbo", "coCbo", "cboCodigo") || achar(p.bruto, /cbo/);
  const par = (k, v) => { if (v) { const d = el("div"); d.append(el("dt", k), el("dd", v)); dados.appendChild(d); } };
  par("CBO", cbo ? String(cbo) : "");
  par("Carga horária", p.carga ? p.carga + " h por semana" : "");
  art.append(topo, dados);
  if (p.vinculo) art.append(el("span", p.vinculo, "pilula " + classeVinculo(p.vinculo)));
  if (p.carga) { const b = el("div", null, "carga"); const barra = el("i"); barra.style.width = Math.min(100, p.carga / 44 * 100) + "%"; b.appendChild(barra); art.appendChild(b); }
  const ficha = el("details", null, "cp-ficha"); ficha.appendChild(el("summary", "Ver todos os dados"));
  const dl = document.createElement("dl");
  for (const [k, v] of Object.entries(p.bruto)) if (!OCULTOS.test(k)) linha(dl, humanizar(k), v);
  ficha.appendChild(dl); art.appendChild(ficha);
  return art;
}

// Gráficos dos profissionais carregados da unidade: ocupações, vínculos e carga horária.
function desenharGrafProf(todos) {
  const box = $("graf-prof"); box.replaceChildren(); box.hidden = !todos.length; if (!todos.length) return;
  const horas = todos.reduce((t, p) => t + p.carga, 0), comCarga = todos.filter(p => p.carga > 0).length;
  const porOcup = new Map(); todos.forEach(p => porOcup.set(p.ocupacao, (porOcup.get(p.ocupacao) || 0) + 1));
  const porVinc = new Map(); todos.forEach(p => porVinc.set(p.vinculo || "Não informado", (porVinc.get(p.vinculo || "Não informado") || 0) + 1));
  const faixas = [["Até 20 h", p => p.carga > 0 && p.carga <= 20], ["21 a 30 h", p => p.carga > 20 && p.carga <= 30], ["31 a 40 h", p => p.carga > 30 && p.carga <= 40], ["Mais de 40 h", p => p.carga > 40]];
  const kp = el("div", null, "kpis");
  kp.append(indicador("Profissionais", todos.length + (estado.profFim ? "" : "+")), indicador("Ocupações", porOcup.size),
            indicador("Carga média", comCarga ? (horas / comCarga).toFixed(1).replace(".", ",") + " h" : "—", "por semana"));
  const g = el("div", null, "graficos");
  g.append(cartaoGrafico("Por ocupação", barras([...porOcup].map(([rotulo, valor]) => ({ rotulo, valor })), { max: 6 })),
           cartaoGrafico("Por vínculo", rosca([...porVinc].map(([rotulo, valor], i) => ({ rotulo, valor, cor: PALETA[i % PALETA.length] })), { numero: todos.length, texto: "profissionais" })),
           cartaoGrafico("Carga horária semanal", barras(faixas.map(([rotulo, f]) => ({ rotulo, valor: todos.filter(f).length })), { max: 4, cor: "var(--verde)" })));
  box.append(kp, g);
}

function desenharProfs() {
  const todos = estado.profs; $("fer-prof").hidden = !todos.length;
  const vSel = $("vinc-prof"), atual = vSel.value;
  const vincs = [...new Set(todos.map(p => p.vinculo).filter(Boolean))].sort();
  vSel.replaceChildren(el("option", "Todos os vínculos")); vSel.firstChild.value = "";
  for (const v of vincs) { const o = el("option", v); o.value = v; vSel.appendChild(o); }
  vSel.value = vincs.includes(atual) ? atual : "";
  const cont = new Map(); todos.forEach(p => cont.set(p.ocupacao, (cont.get(p.ocupacao) || 0) + 1));
  const topo = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ch = $("chips-prof"); ch.replaceChildren();
  for (const [nome, n] of [["", todos.length], ...topo]) {
    const b = el("button", (nome || "Todas") + " (" + n + ")"); b.type = "button"; b.setAttribute("aria-pressed", String(estado.ocup === nome));
    b.addEventListener("click", () => { estado.ocup = nome; desenharProfs(); }); ch.appendChild(b);
  }
  desenharGrafProf(todos);
  const q = semAcento($("q-prof").value);
  const lista = todos.filter(p => (!estado.ocup || p.ocupacao === estado.ocup) && (!vSel.value || p.vinculo === vSel.value) &&
    (!q || semAcento([p.titulo, p.detalhe, p.ocupacao].join(" ")).includes(q)));
  const ord = $("ord-prof").value;
  if (ord === "ocup") lista.sort((a, b) => a.ocupacao.localeCompare(b.ocupacao, "pt-BR"));
  if (ord === "carga") lista.sort((a, b) => b.carga - a.carga);
  const corpo = $("corpo-prof"); corpo.replaceChildren();
  const grupos = new Map();
  for (const p of lista) { if (!grupos.has(p.ocupacao)) grupos.set(p.ocupacao, []); grupos.get(p.ocupacao).push(p); }
  for (const [ocup, ps] of grupos) {
    const sec = el("section", null, "grupo-prof");
    const h = el("h3", ocup); h.append(el("span", String(ps.length), "contador"));
    const grade = el("div", null, "grade-prof"); ps.forEach(p => grade.appendChild(cartaoProf(p)));
    sec.append(h, grade); corpo.appendChild(sec);
  }
  if (!lista.length) corpo.appendChild(el("p", "Nenhum profissional com esses filtros.", "vazio"));
  $("cont-prof").textContent = "Mostrando " + lista.length + " de " + todos.length + " carregados";
}
["q-prof", "ord-prof", "vinc-prof"].forEach(id => $(id).addEventListener("input", desenharProfs));

async function carregarProfs(paginas, token) {
  const mais = $("btn-mais-prof"), tudo = $("btn-tudo-prof"), msg = $("msg-prof");
  mais.disabled = tudo.disabled = true; msg.className = "nota"; msg.textContent = "Carregando profissionais…";
  try {
    for (let i = 0; i < paginas && !estado.profFim; i++) {
      const r = estado.demo ? { itens: DEMO.profissionais.map(normalizarProf), cheia: false, variante: 0 }
                            : await buscarProfissionaisUnidade(estado.sel.cnes, estado.codigo, estado.profPag, estado.variante, estado.sel.idPortal);
      if (token !== estado.token) return;
      estado.variante = r.variante; estado.profPag++; estado.profFim = !r.cheia; estado.profs.push(...r.itens);
    }
    msg.textContent = "";
    desenharProfs(); $("qtd-prof").textContent = estado.profs.length ? "(" + estado.profs.length + (estado.profFim ? "" : "+") + ")" : ""; if (!estado.profs.length) mostrarDiag();
    mostrarVazioProf(!estado.profs.length, false);
  } catch (erro) { if (token === estado.token) { msg.textContent = ""; mostrarVazioProf(!estado.profs.length, true, erro.message); mostrarDiag(); } }
  mais.hidden = tudo.hidden = estado.profFim; mais.disabled = tudo.disabled = false;
}

// Estado vazio amigável (em vez de uma tabela sem linhas): explica e oferece o caminho oficial.
function mostrarVazioProf(vazio, falhou, detalhe) {
  $("vazio-prof").hidden = !vazio; $("corpo-prof").hidden = vazio;
  if (!vazio) return;
  $("vazio-tit").textContent = falhou ? "Não consegui buscar os profissionais agora" : "Nenhum profissional retornado nesta consulta";
  $("vazio-txt").textContent = falhou ? "A consulta falhou: " + detalhe + ". Tente de novo." : "Abra o diagnóstico abaixo para ver o que cada fonte respondeu.";
  $("diag").open = true;
  $("vazio-cnes").textContent = estado.sel.cnes;
  $("fer-prof").hidden = true; $("btn-mais-prof").hidden = $("btn-tudo-prof").hidden = true;
}

function abrirSecaoProfissionais(token) {
  mostrarVazioProf(false);
  $("secao-prof").hidden = false; $("tit-prof").textContent = "Profissionais de saúde · " + estado.sel.nome; $("prof-turno").textContent = turnoDe(estado.sel) || "não informado no CNES";
  $("corpo-prof").replaceChildren(); $("fer-prof").hidden = true; $("q-prof").value = ""; $("ord-prof").value = "";
  $("btn-mais-prof").hidden = $("btn-tudo-prof").hidden = true;
  carregarProfs(PAGINAS_POR_CLIQUE, token);
}

// ---------- rota ----------
const pegarPosicao = () => new Promise((ok, falha) => {
  if (!navigator.geolocation) return falha(new Error("navegador sem geolocalização"));
  navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => falha(new Error("permissão de localização negada")));
});

async function tracarRota() {
  const msg = $("det-rota"); if (!temCoordenada(estado.sel)) return;
  msg.className = ""; msg.textContent = "Obtendo sua localização…";
  try {
    const origem = await pegarPosicao(); const rota = await buscarRota(origem, estado.sel);
    desenharRota(rota, origem);
    msg.textContent = (rota.distance / 1000).toFixed(1) + " km · cerca de " + Math.round(rota.duration / 60) + " min de carro.";
  } catch (erro) { msg.className = "erro"; msg.textContent = "Não foi possível traçar a rota: " + erro.message + "."; }
}

$("filtro-municipio").addEventListener("input", ev => preencherMunicipios(ev.target.value));
$("btn-limpar").addEventListener("click", limparBusca);
$("form-busca").addEventListener("submit", ev => { ev.preventDefault(); buscar(false); });
$("btn-mais").addEventListener("click", () => buscar(true));
$("btn-voltar").addEventListener("click", () => { $("vista-detalhe").hidden = true; $("vista-lista").hidden = false; $("secao-prof").hidden = true; estado.token++; desenharPontos(visiveis(), abrirDetalhe); });
$("btn-rota").addEventListener("click", tracarRota);
$("btn-mais-prof").addEventListener("click", () => carregarProfs(1, estado.token));
$("btn-tentar-prof").addEventListener("click", () => { estado.profs = []; estado.profPag = 0; estado.profFim = false; estado.variante = 0; carregarProfs(PAGINAS_POR_CLIQUE, estado.token); });
$("btn-copiar-cnes").addEventListener("click", async () => { try { await navigator.clipboard.writeText(estado.sel.cnes); toast("Código CNES copiado: " + estado.sel.cnes, "ok"); } catch { toast("Código CNES: " + estado.sel.cnes); } });
$("btn-tudo-prof").addEventListener("click", () => carregarProfs(5, estado.token));
exigirLogin().then(u => { if (!u) return; montarNavbar(u, "mapa"); iniciar(); });


// ---------- miniaturas na lista: só busca a foto quando o cartão aparece na tela, 2 por vez, e lembra o resultado ----------
const fotoCache = new Map(); const filaFoto = []; let fotosAtivas = 0;
const obsFoto = "IntersectionObserver" in window ? new IntersectionObserver(ents => ents.forEach(x => {
  if (x.isIntersecting) { obsFoto.unobserve(x.target); filaFoto.push(x.target); bombearFotos(); }
}), { rootMargin: "120px" }) : null;
function miniFoto(e, alvo) {
  if (estado.demo || e.fonte === "osm") return;
  alvo._e = e; if (fotoCache.has(e.cnes)) return pintarMini(alvo, fotoCache.get(e.cnes));
  obsFoto ? obsFoto.observe(alvo) : null;
}
function pintarMini(alvo, f) {
  if (!f) return; const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.src = f.url;
  img.onload = () => { alvo.replaceChildren(img); alvo.classList.add("com-foto"); };
}
function bombearFotos() {
  while (fotosAtivas < 2 && filaFoto.length) {
    const alvo = filaFoto.shift(); if (!alvo.isConnected) continue; fotosAtivas++;
    const e = alvo._e;
    (fotoCache.has(e.cnes) ? Promise.resolve(fotoCache.get(e.cnes)) : buscarFoto(e).catch(() => null)).then(f => { fotoCache.set(e.cnes, f); pintarMini(alvo, f); })
      .finally(() => { fotosAtivas--; bombearFotos(); });
  }
}


// ---------- horário de funcionamento ----------
function mostrarHorario(e) {
  const hor = horarioDe(e);
  $("det-turno").textContent = e.ficha || e.fichaTentada || hor.obs ? hor.texto : "Consultando a ficha do CNES…";
  $("det-turno-obs").textContent = hor.obs ? "(" + hor.obs + ")" : "";
  $("prof-turno").textContent = hor.texto;
}
// A lista do portal não traz "Sempre aberto"; quando a ficha chega, o selo do cartão é corrigido na hora.
function atualizarSelosHorario(e) {
  const h = horarioDe(e), c = complexidadeDe(e, estado.tipos.get(e.tipoCodigo));
  document.querySelectorAll('.selo-c[data-cnes="' + e.cnes + '"]').forEach(s => { s.textContent = c.nivel ? "Complexidade " + c.curto.toLowerCase() : ""; s.className = "selo-c " + c.nivel; s.hidden = !c.nivel; });
  document.querySelectorAll('.selo-h[data-cnes="' + e.cnes + '"]').forEach(s => { s.textContent = (h.h24 ? "● " : "🕒 ") + h.curto; s.className = "selo-h" + (h.h24 ? " h24" : ""); });
}

function mostrarComplexidade(e) {
  const c = complexidadeDe(e, estado.tipos.get(e.tipoCodigo));
  $("det-compl").textContent = c.texto; $("det-compl-obs").textContent = c.obs ? "(" + c.obs + ")" : "";
}
