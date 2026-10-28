// Acesso aos dados. O navegador fala só com o back-end PHP (pasta backend/),
// que consulta a API do Ministério da Saúde e o IBGE.
// Regras da API do Ministério: limit ≤ 20; offset = número da página; códigos inteiros; status=1 = ativos.
const BACKEND = "backend";
const UF_MA = 21;
const LIMITE = 20;

const semAcento = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Registro das últimas chamadas ao back-end (usado no "Diagnóstico da API", que só aparece quando algo vem vazio ou falha).
const DIAG = [];
function anotar(nota, status, ms, trecho) {
  if (!nota) return;
  DIAG.push({ ...nota, status, ms, trecho: String(trecho || "").replace(/\s+/g, " ").slice(0, 220) });
  if (DIAG.length > 15) DIAG.shift();
}

async function lerJson(url, nota) {
  let resp; const t0 = performance.now();
  try { resp = await fetch(url, { headers: { Accept: "application/json" } }); }
  catch { anotar(nota, "sem resposta", Math.round(performance.now() - t0), "falha de conexão"); throw new Error("sem conexão com o servidor"); }
  if (resp.status === 401 && !nota?.direto) { location.replace("login.html"); throw new Error("Sessão expirada"); }
  const texto = await resp.text();
  anotar(nota, "HTTP " + resp.status, Math.round(performance.now() - t0), texto);
  let dados;
  try { dados = JSON.parse(texto); }
  catch { throw new Error(nota?.direto ? "resposta inválida da API" : "o PHP não está rodando (use: php -S localhost:8000)"); }
  if (!resp.ok) { const e = new Error(dados.erro || dados.message || "HTTP " + resp.status); e.rede = resp.status === 502 && dados.origem === "rede"; throw e; }
  return nota?.objeto ? dados : extrairLista(dados);   // objeto: ficha de um estabelecimento (não uma lista)
}
// A resposta pode ser a lista direta, {chave: [...]} ou ter a lista dentro de outro objeto: pega a maior lista de objetos.
function extrairLista(d, nivel = 0) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object" || nivel > 3) return [];
  let melhor = [];
  for (const v of Object.values(d)) { const l = extrairLista(v, nivel + 1); if (l.length > melhor.length) melhor = l; }
  return melhor;
}

// Caminho principal: navegador → PHP (backend/saude.php) → API do Ministério.
// Se o PHP não conseguir falar com a API (ex.: "Connection was reset"), o navegador tenta a API pública direto
// (ela libera CORS) e, a partir daí, passa a usar o caminho direto nas próximas chamadas.
const API_MS = "https://apidadosabertos.saude.gov.br";
let modoDireto = false;
async function chamarSaude(rota, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) qs.set(k, v);
  const direta = () => lerJson(`${API_MS}${rota}?${qs}`, { rota, params: Object.fromEntries(qs), direto: true });
  if (rota.startsWith("/portal/")) return lerJson(`${BACKEND}/saude.php?${new URLSearchParams({ rota, ...Object.fromEntries(qs) })}`, { rota, params: Object.fromEntries(qs), objeto: /^\/portal\/estabelecimentos\/\d{13}$/.test(rota) });
  if (modoDireto) { try { return await direta(); } catch { modoDireto = false; } }
  const viaPhp = new URLSearchParams({ rota, ...Object.fromEntries(qs) });
  try { return await lerJson(`${BACKEND}/saude.php?${viaPhp}`, { rota, params: Object.fromEntries(qs) }); }
  catch (erro) {
    if (!erro.rede) throw erro;
    try { const r = await direta(); modoDireto = true; return r; }
    catch { throw erro; }
  }
}

const campo = (o, ...nomes) => { for (const n of nomes) if (o[n] != null && o[n] !== "") return o[n]; return ""; };
const achar = (o, re) => { const k = Object.keys(o).find(x => re.test(x) && o[x] != null && o[x] !== ""); return k ? o[k] : ""; };
const numero = v => parseFloat(String(v).replace(",", "."));

function gestaoDe(r) {
  const t = semAcento(campo(r, "tipo_gestao", "descricao_tipo_gestao", "codigo_tipo_gestao", "descricao_esfera_administrativa", "esfera_administrativa", "coEsferaAdministrativa", "tpGestao"));
  if (/dupla|^d$/.test(t)) return "D";
  if (/estad|^e$/.test(t)) return "E";
  if (/munic|^m$/.test(t)) return "M";
  return "?";
}

function normalizarEstab(r) {
  // Aceita os dois formatos: API de Dados Abertos (snake_case) e portal do CNES (noFantasia, noLogradouro…).
  const rua = [campo(r, "endereco_estabelecimento", "logradouro", "noLogradouro"), campo(r, "numero_estabelecimento", "numero", "nuEndereco"),
               campo(r, "bairro_estabelecimento", "bairro")].filter(Boolean).join(", ");
  return {
    tipoCodigo: String(campo(r, "codigo_tipo_unidade", "coTpUnidade", "tpUnidade")),
    cnes: String(campo(r, "codigo_cnes", "cnes")),
    nome: campo(r, "nome_fantasia", "nome_razao_social", "razao_social", "noFantasia", "noEmpresarial") || "(sem nome)",
    gestao: gestaoDe(r), endereco: rua,
    telefone: campo(r, "numero_telefone_estabelecimento", "telefone", "nuTelefone"),
    email: campo(r, "endereco_email_estabelecimento", "email"),
    lat: numero(campo(r, "latitude_estabelecimento_decimo_grau", "latitude", "nuLatitude")),
    lng: numero(campo(r, "longitude_estabelecimento_decimo_grau", "longitude", "nuLongitude")),
    idPortal: String(campo(r, "id")),
    ender: { rua: campo(r, "endereco_estabelecimento", "logradouro", "noLogradouro"), num: campo(r, "numero_estabelecimento", "numero", "nuEndereco"),
             bairro: campo(r, "bairro_estabelecimento", "bairro"), cep: campo(r, "cep", "codigo_cep_estabelecimento", "nuCep"),
             municipio: campo(r, "noMunicipio", "nome_municipio", "descricao_municipio") },
    bruto: r,
  };
}

// A base pública de profissionais descreve ocupação, vínculo e carga horária e pode NÃO trazer o nome
// (dado pessoal). Procuramos qualquer campo de nome de pessoa; se não houver, o título é a ocupação (CBO).
function normalizarProf(r) {
  const chaveNome = ["nome", "noProfissional", "nmProfissional", "noPessoa", "nome_profissional"].find(k => r[k]) ||
    Object.keys(r).find(k => /nome/.test(k) && r[k] &&
    !/(estab|fantasia|razao|munic|unid|mae|pai|equipe|ocupa|cbo|vinc|logradouro|bairro)/.test(k));
  const nome = chaveNome ? String(r[chaveNome]) : "";
  const ocupacao = campo(r, "descricao_cbo", "descricao_ocupacao", "ocupacao", "dsCbo", "dsOcupacao", "cboDescricao") || achar(r, /(desc|nome).*(cbo|ocupa)/);
  const portal = "chAmb" in r || "chHosp" in r || "chOutros" in r || "vinculacao" in r;   // formato do portal do CNES
  const cbo = campo(r, "codigo_cbo", "cbo", "coCbo", "cboCodigo") || achar(r, /cbo/);
  const codigo = achar(r, /(cns|codigo_prof|id_prof)/);
  const carga = portal ? (Number(r.chAmb || 0) + Number(r.chHosp || 0) + Number(r.chOutros || 0)) : achar(r, /carga/);
  const vinculo = portal ? [r.vinculacao, r.vinculo, r.subVinculo].filter(Boolean).join(" / ") : achar(r, /(vinc|contrat)/);
  return {
    titulo: nome || ocupacao || "Profissional de saúde", nome, cbo: String(cbo || ""), codigo: String(codigo || ""),
    semNome: !nome, ocupacao: ocupacao || "Não informada", vinculo: String(vinculo || ""), carga: parseFloat(String(carga).replace(",", ".")) || 0,
    detalhe: [nome && ocupacao, cbo && "CBO " + cbo, codigo && "Cód. " + codigo, carga && carga + " h/sem", vinculo].filter(Boolean).join(" · "),
    cnes: String(campo(r, "codigo_cnes", "cnes") || achar(r, /cnes/)),
    localNome: campo(r, "nome_fantasia", "nome_estabelecimento", "noFant") || achar(r, /(nome|razao).*(estab|fantasia)/),
    bruto: r,
  };
}

// Turno de atendimento da unidade (ex.: "Manhã e tarde"), como declarado ao CNES.
const turnoDe = e => { const t = campo(e.bruto, "descricao_turno_atendimento", "turno_atendimento") || achar(e.bruto, /(turno|horario)/i); return t ? frase(t) : ""; };

// Horário de funcionamento. O portal do CNES informa "Sempre aberto" (tpSempreAberto = S); senão usamos o turno declarado.
function horarioDe(e) {
  const b = e.bruto, sempre = String(campo(b, "tpSempreAberto", "sempre_aberto")).trim().toUpperCase();
  const turno = turnoDe(e);
  if (sempre === "S") return { texto: "Sempre aberto (24 horas)", curto: "24 h", h24: true, obs: "informado no CNES" };
  if (turno) return { texto: turno, curto: turno, h24: false, obs: "turno declarado ao CNES" };
  if (sempre === "N") return { texto: "Não funciona 24 h (horário definido pela unidade)", curto: "Não é 24 h", h24: false, obs: "o CNES só informa que não é 24 h" };
  return { texto: "Não informado no CNES", curto: "Não informado", h24: false, obs: "" };
}

// Complexidade: usa o campo do CNES quando existir; senão, estima pelo tipo da unidade (rótulo deixa isso claro).
// nivel: "baixa" | "media" | "alta" | "urgencia" | "" (para a cor do selo)
function complexidadeDe(e, nomeTipo) {
  const doCnes = achar(e.bruto, /(complex|hierarq)/);
  if (doCnes) return { texto: String(doCnes), curto: String(doCnes), nivel: "media", obs: "informada no CNES" };
  const hosp = simNao(campo(e.bruto, "estabelecimento_possui_atendimento_hospitalar"));
  // 1º o tipo principal da unidade (dsTpUnidade); se ele não decidir, o subtipo (dsTipoEstabelecimento) e o nome.
  const classes = [
    [/(samu|urgencia|movel|pronto|upa\b|pronto atend)/, "Urgência e emergência", "Urgência", "urgencia"],
    [/(hospital|maternidade|unidade mista|pronto socorro)/, "Média e alta complexidade (hospitalar)", "Média/alta", "alta"],
    [/(posto|basica|centro de saude|ubs|familia|imunizacao|academia da saude|saude indigena)/, "Atenção primária (baixa complexidade)", "Baixa", "baixa"],
    [/(clinica|policlinica|ambulatorio|consultorio|especializ|psicossocial|caps\b|laboratorio|diagnose|sadt|terapia|reabilit|odonto|atencao domiciliar|home care|dialise|hemoterapia|oncolog|parto)/, "Média complexidade (ambulatorial)", "Média", "media"],
    [/(farmacia|central de|gestao|vigilancia|telessaude|cooperativa|regulacao|abastecimento|polo de prevencao|transplante|casa de apoio|casas de apoio)/, "Apoio e gestão (sem nível de complexidade)", "Apoio", "apoio"],
  ];
  const tPrim = semAcento(nomeTipo || campo(e.bruto, "descricao_tipo_unidade", "dsTpUnidade") || ""), tSec = semAcento([campo(e.bruto, "dsTipoEstabelecimento"), hosp ? "hospital" : "", e.nome].join(" "));
  const achou = t => t && classes.find(([re]) => re.test(t));
  const hit = achou(tPrim) || achou(tSec);
  return hit ? { texto: hit[1], curto: hit[2], nivel: hit[3], obs: "estimada pelo tipo de unidade" } : { texto: "Não informada", curto: "—", nivel: "", obs: "" };
}

// Serviços especializados declarados ao CNES. Os nomes dos campos variam, então procuramos por padrão.
function normalizarServico(r) {
  const nome = achar(r, /^(descricao|nome)[a-z_]*servico/) || achar(r, /servico/) || "Serviço";
  const classe = achar(r, /classifica/);
  const sus = achar(r, /(sus|atende)/);
  return { nome: limparServico(nome), classe: classe ? limparServico(classe) : "", sus: sus ? String(sus) : "", bruto: r };
}
// Algumas respostas ignoram o filtro codigo_cnes e devolvem registros de OUTRAS unidades (daí o mesmo serviço para todo mundo).
// Se o registro informa o CNES, só aceitamos o da unidade aberta.
const mesmaUnidade = (r, cnes) => { const v = campo(r, "codigo_cnes", "cnes") || achar(r, /^(codigo_)?cnes|cnes$/); return v === "" || !Number.isFinite(Number(v)) || Number(v) === Number(cnes); };

// Tira o código numérico do começo ("112 - SERVICO DE ...") e deixa o texto legível.
const SIGLAS = new Set(["sus", "dst", "aids", "hiv", "uti", "cnes"]);
function limparServico(t) {
  const txt = String(t).replace(/^\s*\d+\s*[-–.]\s*/, "").trim().toLowerCase();
  const palavras = txt.split(/\s+/).map((w, i) => (SIGLAS.has(w) ? w.toUpperCase() : (["de", "da", "do", "das", "dos", "e", "em", "a", "o", "ao", "para", "com", "por", "no", "na"].includes(w) && i ? w : w.charAt(0).toUpperCase() + w.slice(1))));
  return palavras.join(" ").replace(/Pre-natal/g, "Pré-natal").replace(/Atencao/g, "Atenção").replace(/Servico/g, "Serviço").replace(/Acompanhamento/g, "Acompanhamento");
}

// Leitos por especialidade/tipo de um hospital (API: hospitais-e-leitos). Campos variam, então procuramos por padrão.
const ehTexto = v => v != null && v !== "" && !Number.isFinite(numero(v)) && typeof v !== "object";
function normalizarLeito(r) {
  const chaves = Object.keys(r);
  // Nome: valores de TEXTO dos campos descritivos (ex.: "Clínico" + "Clínica geral"); nunca um número.
  const textos = chaves.filter(k => /(descr|nome|tipo|especial|leito|grupo|natureza)/.test(k) && !/(estab|fantasia|razao|munic|logradouro|bairro|cnes|uf$|email|telefone|cnpj)/.test(k) && ehTexto(r[k]))
    .map(k => String(r[k]).trim());
  const nome = [...new Set(textos)].slice(0, 2).join(" - ");
  const qtds = chaves.filter(k => /(quant|qtd|existe|total|leito|sus)/.test(k) && !/(codigo|cnes|cep|cnpj|telefone|latitude|longitude|descr|nome)/.test(k) && Number.isFinite(numero(r[k])));
  const pick = re => { const k = qtds.find(x => re.test(x)); return k ? numero(r[k]) : NaN; };
  const sus = pick(/sus/);
  const total = pick(/(existe|total)/) || (qtds.length ? numero(r[qtds.find(k => !/sus/.test(k)) || qtds[0]]) : NaN);
  return { nome: nome ? limparServico(nome) : "", total: Number.isFinite(total) ? total : NaN, sus: Number.isFinite(sus) ? sus : NaN, bruto: r };
}
// A rota de leitos NÃO filtra por estabelecimento (devolve os hospitais do Nordeste/UF inteira). Por isso:
//  1) pedimos por município (e também por CNES, caso a API aceite) e percorremos as páginas;
//  2) só guardamos linhas que pertencem MESMO à unidade aberta: algum campo com o código CNES dela, ou com o nome dela.
const soDigitos = v => String(v).replace(/\D/g, "").replace(/^0+/, "");
function ehDaUnidade(r, e) {
  const alvo = soDigitos(e.cnes), nomes = [e.nome, campo(e.bruto, "nome_razao_social", "razao_social")].filter(Boolean).map(semAcento);
  return Object.values(r).some(v => {
    if (v == null || typeof v === "object") return false;
    const t = String(v).trim();
    if (/^\d{6,7}$/.test(t) && soDigitos(t) === alvo) return true;
    return t.length > 5 && nomes.includes(semAcento(t));
  });
}
async function buscarLeitos(e, municipio) {
  const achadas = []; let primeiroErro = null, algumaOk = false;
  const pagina = async (f, pag) => { try { const b = await chamarSaude("/assistencia-a-saude/hospitais-e-leitos", { ...f, limit: LIMITE, offset: pag }); algumaOk = true; return b; } catch (err) { primeiroErro = primeiroErro || err; return null; } };
  // por CNES (se a API respeitar o filtro) e por município, em lotes de 6 páginas em paralelo
  for (const [f, maxPag] of [[{ codigo_cnes: e.cnes }, 6], [{ codigo_uf: UF_MA, codigo_municipio: municipio }, 60]]) {   // 1ª tentativa é barata: só 6 páginas
    for (let ini = 0; ini < maxPag; ini += 6) {
      const lote = await Promise.all(Array.from({ length: 6 }, (_, k) => pagina(f, ini + k)));
      let fim = false;
      for (const b of lote) { if (!b) { fim = true; continue; } achadas.push(...b.filter(r => ehDaUnidade(r, e))); if (b.length < LIMITE) fim = true; }
      if (fim) break;
    }
    if (achadas.length) break;
  }
  if (!algumaOk && primeiroErro) throw primeiroErro;
  const vistos = new Set();
  return achadas.map(normalizarLeito).filter(l => { const k = JSON.stringify(l.bruto); if (vistos.has(k)) return false; vistos.add(k); return true; });
}

async function buscarServicos(cnes, pagina) {
  const bruto = await chamarSaude("/assistencia-a-saude/cnes-servicos-especializados", { codigo_cnes: cnes, limit: LIMITE, offset: pagina });
  const daUnidade = bruto.filter(r => mesmaUnidade(r, cnes));
  return { itens: daUnidade.map(normalizarServico), cheia: bruto.length >= LIMITE && daUnidade.length > 0 };
}

// Foto do estabelecimento: Wikimedia Commons (pública, sem chave). 1º pelo nome, 2º por foto tirada a até 150 m.
async function buscarFoto(e) {
  const comuns = new Set(["hospital","unidade","saude","centro","posto","municipal","estadual","maternidade","pronto","atendimento","clinica","policlinica","regional","geral","maranhao","upa","para","dos","das","sao","luis"]);
  const tokens = semAcento(e.nome).split(/[^a-z0-9]+/).filter(t => t.length > 3 && !comuns.has(t));
  const base = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=520&gsrnamespace=6";
  const filtrar = pags => Object.values(pags || {}).filter(p => p.imageinfo && /\.(jpe?g|png|webp)$/i.test(p.title) &&
    String(p.imageinfo[0].thumburl || "").startsWith("https://upload.wikimedia.org/"));
  const ler = async url => { try { const r = await fetch(url); return r.ok ? (await r.json()).query?.pages : null; } catch { return null; } };
  const info = p => ({ url: p.imageinfo[0].thumburl, pagina: p.imageinfo[0].descriptionurl, titulo: p.title.replace(/^File:/, "") });

  if (tokens.length) {
    const achadas = filtrar(await ler(base + "&generator=search&gsrlimit=8&gsrsearch=" + encodeURIComponent(e.nome + " Maranhão")))
      .filter(p => tokens.some(t => semAcento(p.title).includes(t)));
    if (achadas.length) return { ...info(achadas[0]), tipo: "nome" };
  }
  if (temCoordenada(e)) {
    const perto = filtrar(await ler(base.replace("gsrnamespace", "ggsnamespace") + `&generator=geosearch&ggscoord=${e.lat}|${e.lng}&ggsradius=150&ggslimit=5`));
    if (perto.length) return { ...info(perto[0]), tipo: "proxima" };
  }
  return null;
}

async function listarMunicipiosMA() {
  try { return await lerJson(`${BACKEND}/municipios.php`); }
  catch {   // plano B: IBGE direto (tem CORS liberado)
    const lista = await lerJson("https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios");
    return lista.map(m => ({ nome: m.nome, codigo: String(m.id).slice(0, 6) }));
  }
}

async function listarTipos() {
  const lista = await chamarSaude("/cnes/tipounidades");
  return lista.map(t => ({ codigo: campo(t, "codigo_tipo_unidade", "codigo"), nome: campo(t, "descricao_tipo_unidade", "descricao", "nome") }))
              .filter(t => t.codigo !== "" && t.nome);
}

// Fonte 1: portal do CNES (backend/saude.php → cnes.datasus.gov.br/services/estabelecimentos).
// O portal devolve a lista do município de uma vez; o filtro de tipo é feito aqui. Os nomes dos parâmetros
// de busca são tentados em ordem (ajuste em PARAMS_ESTAB_PORTAL se o portal usar outros).
const PARAMS_ESTAB_PORTAL = m => [{ municipio: m }, { estado: UF_MA, municipio: m }, { uf: UF_MA, municipio: m }];
const tiposPortal = new Map();   // código → nome, aprendido das próprias unidades (serve de filtro quando /cnes/tipounidades falha)
let estabViaPortal = false;
async function buscarEstabPortal(municipio, tipo) {
  let ultimoErro = null;
  for (const params of PARAMS_ESTAB_PORTAL(municipio)) {
    try {
      const bruto = await chamarSaude("/portal/estabelecimentos", params);
      let lista = bruto.filter(r => r && typeof r === "object" && (r.cnes || r.noFantasia));
      // se o portal ignorar o parâmetro e devolver outros municípios, só ficam os do município pedido
      lista = lista.filter(r => { const m = campo(r, "municipio", "coMunicipio", "codigo_municipio"); return m === "" || String(m).slice(0, 6) === String(municipio).slice(0, 6); });
      if (!lista.length) continue;
      for (const r of lista) { const c = campo(r, "coTpUnidade", "tpUnidade"), n = campo(r, "dsTpUnidade"); if (c !== "" && n) tiposPortal.set(String(c), frase(n)); }
      if (tipo) lista = lista.filter(r => String(campo(r, "coTpUnidade", "tpUnidade")) === String(tipo));
      return lista.map(normalizarEstab);
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro || new Error("o portal do CNES não devolveu estabelecimentos");
}

async function buscarEstabelecimentos(municipio, tipo, pagina) {
  if (pagina === 0) {
    try { const itens = await buscarEstabPortal(municipio, tipo); estabViaPortal = true; return { itens, cheia: false }; }
    catch { estabViaPortal = false; }   // portal indisponível → API de Dados Abertos
  } else if (estabViaPortal) return { itens: [], cheia: false };
  const bruto = await chamarSaude("/cnes/estabelecimentos", {
    codigo_uf: UF_MA, codigo_municipio: municipio, codigo_tipo_unidade: tipo, status: 1, limit: LIMITE, offset: pagina });
  return { itens: bruto.map(normalizarEstab), cheia: bruto.length >= LIMITE };
}

// Fontes de profissionais, todas tentadas em paralelo; vale a primeira (na ordem) que devolver dados.
//  1) portal do CNES (lista completa, com nome), identificado por município+CNES ou só CNES;
//  2) API de Dados Abertos do Ministério, nas rotas conhecidas.
const ROTAS_PROF = ["/assistencia-a-saude/cnes-profissionais", "/cnes/profissionais"];
async function buscarProfissionais(filtros, pagina, rota = ROTAS_PROF[0], cnes = filtros.codigo_cnes) {
  const portal = rota.startsWith("/portal/");
  let bruto = await chamarSaude(rota, portal ? filtros : { ...filtros, limit: LIMITE, offset: pagina });
  // O portal pode agrupar os vínculos dentro de cada profissional (ex.: {nome, cns, vinculos: [...]}): abre cada vínculo numa linha.
  bruto = bruto.flatMap(r => {
    if (!r || typeof r !== "object") return [];
    const k = Object.keys(r).find(x => Array.isArray(r[x]) && r[x].length && typeof r[x][0] === "object");
    if (!k) return [r];
    const { [k]: sub, ...pai } = r;
    return sub.map(s => ({ ...pai, ...s }));
  });
  // No portal a consulta já é da unidade (o identificador está na URL): não descartamos linhas por causa do campo CNES.
  const daUnidade = portal ? bruto : bruto.filter(r => mesmaUnidade(r, cnes));
  return { itens: daUnidade.map(normalizarProf), cheia: !portal && bruto.length >= LIMITE && daUnidade.length > 0 };
}

function combosProf(cnes, municipio, idPortal = "") {
  const sete = String(parseInt(cnes, 10)).padStart(7, "0");
  const lista = [];
  const hoje = new Date(), comp = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1); return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, "0"); };
  const ids = [...new Set([String(idPortal || "").replace(/\D/g, ""), String(municipio).slice(0, 6) + sete, sete].filter(x => /^(\d{7}|\d{13})$/.test(x)))];
  for (const id of ids) for (const c of [null, comp(1)])
    lista.push({ rota: "/portal/profissionais/" + id, filtros: c ? { comp: c } : {}, cnes });
  for (const rota of ROTAS_PROF) for (const id of [cnes])
    for (const extra of [{}, { codigo_uf: UF_MA, codigo_municipio: municipio }]) lista.push({ rota, filtros: { codigo_cnes: id, ...extra }, cnes });
  return lista;
}
async function buscarProfissionaisUnidade(cnes, municipio, pagina, variante = 0, idPortal = "") {
  const combos = combosProf(cnes, municipio, idPortal);
  if (pagina > 0 || variante > 0) {
    const c = combos[variante]; const r = await buscarProfissionais(c.filtros, pagina, c.rota, c.cnes); return { ...r, variante };
  }
  const resultados = await Promise.allSettled(combos.map(c => buscarProfissionais(c.filtros, 0, c.rota, c.cnes)));
  const i = resultados.findIndex(r => r.status === "fulfilled" && r.value.itens.length);
  if (i >= 0) return { ...resultados[i].value, variante: i };
  const erros = resultados.filter(r => r.status === "rejected");
  if (erros.length === resultados.length) throw erros[0].reason;
  return { itens: [], cheia: false, variante: 0 };
}

// ---------- nomes amigáveis (nunca mostramos o nome técnico do campo) ----------
const PALAVRAS = { cnes: "CNES", cbo: "CBO", cns: "CNS", cnpj: "CNPJ", cep: "CEP", uf: "UF", sus: "SUS", ch: "CH", amb: "ambulatorial", hosp: "hospitalar",
  ocupacao: "ocupação", descricao: "", codigo: "código", numero: "número", endereco: "endereço", atualizacao: "atualização", horaria: "horária",
  vinculo: "vínculo", municipio: "município", natureza: "natureza", juridica: "jurídica", servico: "serviço", gestao: "gestão", razao: "razão",
  identificador: "", estabelecimento: "", possui: "possui", faz: "faz", competencia: "competência", profissional: "profissional" };
function humanizar(chave) {
  const t = chave.split("_").map(w => (w in PALAVRAS ? PALAVRAS[w] : w)).filter(Boolean).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const OCULTOS = /^(codigo_(uf|municipio|estabelecimento_saude|identificador.*|esfera.*)|numero_cnpj_entidade|latitude.*|longitude.*)$/;

const formatarCnpj = v => String(v).replace(/\D/g, "").padStart(14, "0").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const formatarCep = v => String(v).replace(/\D/g, "").padStart(8, "0").replace(/^(\d{5})(\d{3})$/, "$1-$2");
const formatarDataIso = v => (/^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10).split("-").reverse().join("/") : String(v));
const FRASES = { continuo: "contínuo", plantao: "plantão", sabados: "sábados", manha: "manhã", horas: "horas", feriados: "feriados", domingos: "domingos", intermitente: "intermitente", atendimento: "atendimento" };
const frase = t => { const x = String(t).toLowerCase().replace(/[a-zç]+/g, w => FRASES[w] || w); return x.charAt(0).toUpperCase() + x.slice(1); };
const NATUREZA = { "1015": "Órgão público do Poder Executivo Federal", "1023": "Órgão público do Poder Executivo Estadual ou do Distrito Federal",
  "1031": "Órgão público do Poder Executivo Municipal", "2062": "Sociedade empresária limitada", "3069": "Fundação privada", "3999": "Associação privada" };
const ENSINO = { "01": "Unidade universitária", "02": "Unidade escola superior isolada", "03": "Unidade auxiliar de ensino", "04": "Unidade sem atividade de ensino" };
const simNao = v => ["1", "SIM", "S", "true"].includes(String(v).trim().toUpperCase());

async function buscarRota(de, para) {   // OSRM, serviço público de rotas
  const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${de.lng},${de.lat};${para.lng},${para.lat}?overview=full&geometries=geojson`);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const rota = (await resp.json()).routes?.[0];
  if (!rota) throw new Error("rota não encontrada");
  return rota;
}


// ---------- localização pelo endereço ----------
// O portal do CNES não envia latitude/longitude. Quando faltam, localizamos pelo endereço no Nominatim (OpenStreetMap,
// gratuito, sem chave, ~1 consulta por segundo). O resultado fica guardado no navegador e só vale se cair dentro do Maranhão.
const GEO_URL = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=";
let geoFim = 0;
const lerGeo = c => { try { return JSON.parse(localStorage.getItem("saudinho.geo." + c)); } catch { return null; } };
const gravarGeo = (c, v) => { try { localStorage.setItem("saudinho.geo." + c, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem cache */ } };
async function nominatim(q) {
  const espera = geoFim - Date.now(); if (espera > 0) await new Promise(r => setTimeout(r, espera));
  geoFim = Date.now() + 1150;
  try {
    const r = await fetch(GEO_URL + encodeURIComponent(q), { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const p = (await r.json())[0]; if (!p) return null;
    const lat = parseFloat(p.lat), lng = parseFloat(p.lon);
    return typeof LIMITES_MA === "undefined" || LIMITES_MA.contains([lat, lng]) ? { lat, lng } : null;
  } catch { return null; }
}
// Preenche e.lat/e.lng (e e.aprox quando só o bairro foi achado). Devolve true se a unidade ganhou coordenada.
// 1º a ficha do CNES (nuLatitude/nuLongitude, o dado oficial); 2º o endereço no Nominatim.
// Ficha completa da unidade no portal do CNES (tem coordenadas e "Sempre aberto", que a lista não traz).
// Os campos da ficha são mesclados em e.bruto (sem sobrescrever o que a lista já informou) e a ficha fica guardada em e.ficha.
async function fichaDe(e, codMunicipio) {
  if (e.ficha) return e.ficha;
  if (e.fonte === "osm") return null;
  const sete = String(parseInt(e.cnes, 10) || 0).padStart(7, "0");
  const ids = [...new Set([String(e.idPortal || "").replace(/\D/g, ""), String(codMunicipio || campo(e.bruto, "municipio", "codigo_municipio")).slice(0, 6) + sete].filter(x => /^\d{13}$/.test(x)))];
  for (const id of ids) {
    try {
      const f = await chamarSaude("/portal/estabelecimentos/" + id);
      if (f && typeof f === "object" && !Array.isArray(f)) {
        for (const [k, v] of Object.entries(f)) if (e.bruto[k] == null || e.bruto[k] === "") e.bruto[k] = v;
        e.ficha = f; return f;
      }
    } catch { /* tenta o próximo identificador */ }
  }
  e.fichaTentada = true; return null;
}
async function coordenadaDoCnes(e, codMunicipio) {
  const f = await fichaDe(e, codMunicipio);
  if (!f) return null;
  const lat = numero(campo(f, "nuLatitude", "latitude")), lng = numero(campo(f, "nuLongitude", "longitude"));
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng && (typeof LIMITES_MA === "undefined" || LIMITES_MA.contains([lat, lng]))) return { lat, lng };
  return null;   // a ficha existe mas sem coordenada válida: vale o endereço
}
// Só coordenadas já conhecidas: cache do navegador ou ficha do CNES (rápido, pode rodar várias ao mesmo tempo).
async function localizarOficial(e, codMunicipio) {
  if (e.lat && e.lng && Number.isFinite(e.lat) && Number.isFinite(e.lng)) return false;
  const c = lerGeo(e.cnes);
  if (c) { Object.assign(e, { lat: c.lat, lng: c.lng, aprox: c.aprox }); return true; }
  if (e.semOficial) return false;
  const oficial = await coordenadaDoCnes(e, codMunicipio);
  if (oficial) { Object.assign(e, { ...oficial, aprox: false }); gravarGeo(e.cnes, { ...oficial, aprox: false }); return true; }
  e.semOficial = true; return false;
}
async function localizarPorEndereco(e, nomeMunicipio, codMunicipio) {
  if (e.lat && e.lng && Number.isFinite(e.lat) && Number.isFinite(e.lng)) return false;
  if (await localizarOficial(e, codMunicipio)) return true;
  const mun = e.ender?.municipio || nomeMunicipio, { rua, num, bairro, cep } = e.ender || {};
  const fim = [mun, "Maranhão", "Brasil"].filter(Boolean).join(", ");
  const tentativas = [
    rua && [[num, rua].filter(Boolean).join(" "), bairro, fim].filter(Boolean).join(", "),
    rua && [rua, fim].join(", "),
    cep && [formatarCep(cep), fim].join(", "),
    bairro && [bairro, fim].join(", "),
  ];
  for (let i = 0; i < tentativas.length; i++) {
    if (!tentativas[i]) continue;
    const p = await nominatim(tentativas[i]);
    if (p) { const aprox = i >= 2; Object.assign(e, { ...p, aprox }); gravarGeo(e.cnes, { ...p, aprox }); return true; }
  }
  return false;
}
