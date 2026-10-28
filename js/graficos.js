// Gráficos leves, sem biblioteca: rosca (SVG) e barras horizontais (HTML/CSS). Todo texto entra via textContent.
const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const PALETA = ["#0b4f9c", "#10a07a", "#e0a100", "#8e4ec6", "#d1495b", "#2a9bd6", "#6b7c8c", "#a3b83a"];

// Rosca com legenda. dados: [{ rotulo, valor, cor }]. centro: { numero, texto } escrito no meio.
function rosca(dados, centro) {
  const lista = dados.filter(d => d.valor > 0), total = lista.reduce((t, d) => t + d.valor, 0);
  const box = el("div", null, "rosca");
  const R = 42, C = 2 * Math.PI * R;
  const svg = svgEl("svg", { viewBox: "0 0 120 120", role: "img", "aria-label": lista.map(d => d.rotulo + ": " + d.valor).join("; ") || "sem dados" });
  svg.appendChild(svgEl("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: "#e3ebf3", "stroke-width": 16 }));
  let acum = 0;
  lista.forEach((d, i) => {
    const frac = d.valor / total, cor = d.cor || PALETA[i % PALETA.length];
    const arco = svgEl("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: cor, "stroke-width": 16, transform: "rotate(-90 60 60)",
      "stroke-dasharray": `${Math.max(frac * C - (lista.length > 1 ? 1.5 : 0), 0.01)} ${C}`, "stroke-dashoffset": -acum * C });
    const t = svgEl("title"); t.textContent = `${d.rotulo}: ${d.valor} (${Math.round(frac * 100)}%)`; arco.appendChild(t);
    svg.appendChild(arco); acum += frac;
  });
  if (centro) {
    const n = svgEl("text", { x: 60, y: 62, "text-anchor": "middle", class: "rosca-num" }); n.textContent = centro.numero;
    const l = svgEl("text", { x: 60, y: 77, "text-anchor": "middle", class: "rosca-txt" }); l.textContent = centro.texto;
    svg.append(n, l);
  }
  const leg = el("ul", null, "rosca-leg");
  lista.forEach((d, i) => {
    const li = el("li"), pt = el("i"); pt.style.background = d.cor || PALETA[i % PALETA.length];
    li.append(pt, el("span", d.rotulo), el("strong", d.valor + " · " + Math.round(d.valor / total * 100) + "%")); leg.appendChild(li);
  });
  if (!lista.length) leg.appendChild(el("li", "Sem dados"));
  box.append(svg, leg); return box;
}

// Barras horizontais. dados: [{ rotulo, valor }]. Mostra no máximo `max` linhas.
function barras(dados, { max = 6, cor = "var(--azul)", sufixo = "" } = {}) {
  const lista = dados.filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, max);
  const topo = Math.max(1, ...lista.map(d => d.valor));
  const ul = el("ul", null, "barras");
  for (const d of lista) {
    const li = el("li"), trilho = el("span", null, "trilho"), preen = el("i");
    preen.style.width = Math.max(3, d.valor / topo * 100) + "%"; preen.style.background = cor; trilho.appendChild(preen);
    const nome = el("span", d.rotulo, "b-nome"); nome.title = d.rotulo;
    li.append(nome, trilho, el("strong", d.valor + sufixo)); ul.appendChild(li);
  }
  if (!lista.length) ul.appendChild(el("li", "Sem dados"));
  return ul;
}

// Cartão com título (para agrupar gráficos).
function cartaoGrafico(titulo, conteudo, nota) {
  const c = el("section", null, "cartao-graf"); c.appendChild(el("h4", titulo)); c.appendChild(conteudo);
  if (nota) c.appendChild(el("p", nota, "nota")); return c;
}
// Indicador (número grande + legenda).
function indicador(rotulo, valor, detalhe) {
  const d = el("div", null, "kpi"); d.append(el("small", rotulo), el("strong", String(valor))); if (detalhe) d.appendChild(el("em", detalhe)); return d;
}
