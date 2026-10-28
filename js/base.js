// Gera a base geral do Maranhão (estabelecimentos + profissionais) e baixa em JSON e XLSX.
// A coleta roda no navegador, município por município, e guarda cada município pronto no IndexedDB (dá para pausar e continuar).
const CRIADOR = "André Moura, Engenheiro de Dados e Cientista de Dados";
const PARALELO = 6;           // unidades consultadas ao mesmo tempo
const LIMITE_LINHAS_XLSX = 1000000;   // o Excel aceita 1.048.576 linhas por aba

const estadoBase = { rodando: false, pausar: false, municipios: [], t0: 0 };

// ---------- armazenamento local (IndexedDB) ----------
const bd = {
  db: null,
  abrir() {
    return new Promise((ok, falha) => {
      const r = indexedDB.open("saudinho-base", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("mun", { keyPath: "codigo" });
      r.onsuccess = () => { bd.db = r.result; ok(); }; r.onerror = () => falha(r.error);
    });
  },
  tx(modo) { return bd.db.transaction("mun", modo).objectStore("mun"); },
  todos() { return new Promise((ok, falha) => { const q = bd.tx("readonly").getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => falha(q.error); }); },
  gravar(reg) { return new Promise((ok, falha) => { const q = bd.tx("readwrite").put(reg); q.onsuccess = () => ok(); q.onerror = () => falha(q.error); }); },
  limpar() { return new Promise((ok, falha) => { const q = bd.tx("readwrite").clear(); q.onsuccess = () => ok(); q.onerror = () => falha(q.error); }); },
};

const log = txt => { const p = $("log"); p.textContent += new Date().toLocaleTimeString("pt-BR") + "  " + txt + "\n"; p.scrollTop = p.scrollHeight; };
const fmt = n => n.toLocaleString("pt-BR");
const dur = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + " h " : "") + m + " min"; };

// ---------- profissionais de uma unidade ----------
// A 1ª unidade testa todas as rotas e aprende qual funciona; as seguintes usam só essa (evita ~10 chamadas por unidade).
let formaProf = null;
const formaDe = c => c.rota.replace(/\d+$/, m => "{" + m.length + "}") + JSON.stringify(c.filtros).replace(/\d{6}/, "{comp}");
async function profissionaisDe(e, cod6) {
  if (formaProf == null) {
    const r = await buscarProfissionaisUnidade(e.cnes, cod6, 0, 0, e.idPortal);
    if (r.itens.length) formaProf = formaDe(combosProf(e.cnes, cod6, e.idPortal)[r.variante]);
    return r.itens;
  }
  const c = combosProf(e.cnes, cod6, e.idPortal).find(x => formaDe(x) === formaProf);
  if (!c) { const r = await buscarProfissionaisUnidade(e.cnes, cod6, 0, 0, e.idPortal); return r.itens; }
  const itens = [];
  for (let pag = 0; pag < 60; pag++) {
    const r = await buscarProfissionais(c.filtros, pag, c.rota, c.cnes);
    itens.push(...r.itens);
    if (!r.cheia) break;
  }
  return itens;
}

// ---------- um município ----------
async function coletarMunicipio(m, op, aoProgredir) {
  const lista = await buscarEstabPortal(m.codigo, "");
  const vistos = new Set(), unidades = lista.filter(e => !vistos.has(e.cnes) && vistos.add(e.cnes));
  const estab = [], prof = []; let feitos = 0, falhasProf = 0;
  const fila = [...unidades];
  await Promise.all(Array.from({ length: PARALELO }, async () => {
    while (fila.length && !estadoBase.pausar) {
      const e = fila.shift();
      try {
        if (op.ficha) await fichaDe(e, m.codigo);
        let qtd = null, itens = [];
        if (op.prof) { try { itens = await profissionaisDe(e, m.codigo); qtd = itens.length; } catch { falhasProf++; } }
        const linha = linhaEstab(e, m.nome, qtd, m.codigo);
        estab.push(linha);
        for (const p of itens) prof.push(linhaProf(p, linha));
      } catch (err) { log("  falha na unidade " + e.cnes + ": " + err.message); }
      feitos++; aoProgredir(feitos, unidades.length, estab.length, prof.length);
    }
  }));
  return { completo: !estadoBase.pausar, estab, prof, falhasProf, total: unidades.length };
}

// ---------- coleta geral ----------
async function gerar() {
  if (estadoBase.rodando) return;
  const op = { ficha: $("op-ficha").checked, prof: $("op-prof").checked };
  const alvo = $("alvo").value;
  const feitos = new Map((await bd.todos()).map(r => [r.codigo, r]));
  const lista = estadoBase.municipios.filter(m => !alvo || m.codigo === alvo);
  // se mudou o que coletar (ex.: antes sem profissionais), refaz o município
  const pendentes = lista.filter(m => { const r = feitos.get(m.codigo); return !r || (op.prof && !r.op.prof) || (op.ficha && !r.op.ficha); });
  estadoBase.rodando = true; estadoBase.pausar = false; estadoBase.t0 = Date.now(); formaProf = null;
  $("btn-gerar").hidden = true; $("btn-pausar").hidden = false; $("progresso").hidden = false; $("msg-dados").textContent = "";
  log("Início: " + pendentes.length + " município(s) a coletar, " + (lista.length - pendentes.length) + " já prontos.");
  let i = 0, falhas = 0;
  for (const m of pendentes) {
    if (estadoBase.pausar) break;
    i++;
    const rotulo = `Município ${i} de ${pendentes.length}: ${m.nome}`;
    const prog = (f, t, ne, np) => {
      const parte = t ? f / t : 1;
      $("barra-in").style.width = ((i - 1 + parte) / pendentes.length * 100).toFixed(1) + "%";
      $("prog-txt").textContent = `${rotulo} · unidade ${f} de ${t} · ${fmt(ne)} estabelecimentos, ${fmt(np)} profissionais neste município · ${dur(Date.now() - estadoBase.t0)} decorridos`;
    };
    try {
      prog(0, 0, 0, 0);
      const r = await coletarMunicipio(m, op, prog);
      if (r.completo) {
        await bd.gravar({ codigo: m.codigo, nome: m.nome, op, estab: r.estab, prof: r.prof, falhasProf: r.falhasProf, quando: new Date().toISOString() });
        log(`${m.nome}: ${r.estab.length} estabelecimentos, ${r.prof.length} profissionais` + (r.falhasProf ? ` (${r.falhasProf} unidades sem profissionais por erro)` : ""));
      }
    } catch (err) { falhas++; log(`${m.nome}: não coletado (${err.message})`); }
    $("barra-in").style.width = (i / pendentes.length * 100).toFixed(1) + "%";
    await atualizarNumeros();
  }
  estadoBase.rodando = false;
  $("btn-gerar").hidden = false; $("btn-pausar").hidden = true; $("btn-gerar").textContent = "Continuar a coleta";
  const msg = estadoBase.pausar ? "Coleta pausada. O que já ficou pronto está guardado." : falhas ? `Coleta terminou com ${falhas} município(s) que falharam: clique em “Continuar a coleta” para tentar de novo.` : "Coleta concluída. Baixe os arquivos abaixo.";
  $("msg-dados").textContent = msg; log(msg); estadoBase.pausar = false;
  await atualizarNumeros();
}

async function atualizarNumeros() {
  const regs = await bd.todos();
  const ne = regs.reduce((s, r) => s + r.estab.length, 0), np = regs.reduce((s, r) => s + r.prof.length, 0);
  const n24 = regs.reduce((s, r) => s + r.estab.filter(x => x.funciona_24h === "Sim").length, 0);
  $("n-mun").textContent = fmt(regs.length) + " / " + fmt(estadoBase.municipios.length); $("n-est").textContent = fmt(ne); $("n-prof").textContent = fmt(np); $("n-24").textContent = fmt(n24);
  for (const id of ["btn-json", "btn-xlsx", "btn-limpar-base"]) $(id).disabled = !regs.length;
  if (regs.length && !estadoBase.rodando) $("btn-gerar").textContent = "Continuar a coleta";
  return regs;
}

// ---------- exportação ----------
function baixarBlob(blob, nome) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
const carimbo = () => new Date().toISOString().slice(0, 10);
const metaBase = regs => ({
  titulo: "Base de saúde do Maranhão (estabelecimentos e profissionais)", uf: "MA", gerado_em: new Date().toISOString(),
  fonte: "CNES · Ministério da Saúde (dados abertos)", criador: CRIADOR, projeto: "Saudinho · saúde para todos",
  municipios_incluidos: regs.length, municipios_total: estadoBase.municipios.length,
  estabelecimentos: regs.reduce((s, r) => s + r.estab.length, 0), profissionais: regs.reduce((s, r) => s + r.prof.length, 0),
  observacoes: ["Complexidade estimada pelo tipo da unidade quando o CNES não a informa (coluna complexidade_origem).", "funciona_24h vem do campo “Sempre aberto” da ficha do CNES; “Não informado” quando a ficha não foi coletada.",
    "O nome do profissional só aparece quando o CNES o informa."],
});

async function baixarJson() {
  const regs = (await bd.todos()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const partes = ['{"meta":' + JSON.stringify(metaBase(regs), null, 1) + ',\n"estabelecimentos":['];
  let primeiro = true;
  for (const r of regs) for (const x of r.estab) { partes.push((primeiro ? "\n" : ",\n") + JSON.stringify(x)); primeiro = false; }
  partes.push('\n],\n"profissionais":['); primeiro = true;
  for (const r of regs) for (const x of r.prof) { partes.push((primeiro ? "\n" : ",\n") + JSON.stringify(x)); primeiro = false; }
  partes.push("\n]}");
  baixarBlob(new Blob(partes, { type: "application/json" }), `saudinho-maranhao-${carimbo()}.json`);
}

function folha(linhas, colunas) {
  const ws = XLSX.utils.aoa_to_sheet([colunas.map(c => TITULOS[c] || c), ...linhas.map(l => colunas.map(c => l[c]))]);
  ws["!cols"] = colunas.map(c => ({ wch: Math.min(48, Math.max(10, (TITULOS[c] || c).length + 2, ...linhas.slice(0, 200).map(l => String(l[c] ?? "").length + 1))) }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 }; ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, linhas.length), c: colunas.length - 1 } }) };
  return ws;
}
async function baixarXlsx() {
  if (typeof XLSX === "undefined") { $("msg-dados").textContent = "A biblioteca do Excel não carregou (sem internet?). Use o JSON ou tente de novo."; return; }
  const regs = (await bd.todos()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const meta = metaBase(regs), estab = regs.flatMap(r => r.estab), prof = regs.flatMap(r => r.prof);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, folha(estab, COLUNAS_ESTAB), "Estabelecimentos");
  for (let i = 0, n = 1; i < Math.max(prof.length, 1); i += LIMITE_LINHAS_XLSX, n++) {
    XLSX.utils.book_append_sheet(wb, folha(prof.slice(i, i + LIMITE_LINHAS_XLSX), COLUNAS_PROF), prof.length > LIMITE_LINHAS_XLSX ? "Profissionais " + n : "Profissionais");
  }
  const leia = [["Base de saúde do Maranhão"], [""], ["Gerado em", new Date().toLocaleString("pt-BR")], ["Fonte", meta.fonte], ["Projeto", meta.projeto], ["Criador", meta.criador],
    ["Municípios incluídos", `${meta.municipios_incluidos} de ${meta.municipios_total}`], ["Estabelecimentos", meta.estabelecimentos], ["Profissionais", meta.profissionais], [""], ...meta.observacoes.map(o => ["Nota", o])];
  const wl = XLSX.utils.aoa_to_sheet(leia); wl["!cols"] = [{ wch: 22 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wl, "Leia-me");
  $("msg-dados").textContent = "Montando a planilha… pode levar alguns instantes."; await new Promise(r => setTimeout(r, 30));
  try { XLSX.writeFile(wb, `saudinho-maranhao-${carimbo()}.xlsx`, { compression: true }); $("msg-dados").textContent = "Planilha gerada."; }
  catch (e) { $("msg-dados").textContent = "Não consegui montar o XLSX (" + e.message + "). A base é grande: baixe o JSON ou colete menos municípios por vez."; }
}

// ---------- início ----------
async function iniciarBase() {
  await bd.abrir();
  try { estadoBase.municipios = (await listarMunicipiosMA()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")); } catch { estadoBase.municipios = []; $("msg-dados").textContent = "Não consegui carregar a lista de municípios."; }
  const sel = $("alvo"); for (const m of estadoBase.municipios) { const o = el("option", m.nome); o.value = m.codigo; sel.appendChild(o); }
  $("btn-gerar").addEventListener("click", gerar);
  $("btn-pausar").addEventListener("click", () => { estadoBase.pausar = true; $("btn-pausar").disabled = true; $("prog-txt").textContent += " · pausando ao fim das unidades em andamento…"; setTimeout(() => { $("btn-pausar").disabled = false; }, 4000); });
  $("btn-json").addEventListener("click", baixarJson);
  $("btn-xlsx").addEventListener("click", baixarXlsx);
  $("btn-limpar-base").addEventListener("click", async () => { if (confirm("Apagar tudo o que já foi coletado neste navegador?")) { await bd.limpar(); $("btn-gerar").textContent = "Gerar a base"; await atualizarNumeros(); } });
  await atualizarNumeros();
}
exigirLogin().then(u => { if (!u) return; montarNavbar(u, "base"); iniciarBase().catch(e => { $("msg-dados").textContent = "Erro ao iniciar: " + e.message; }); });
