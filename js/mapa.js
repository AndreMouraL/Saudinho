// Mapa (Leaflet + OpenStreetMap). Cor do ponto = gestão: azul estadual, verde municipal, âmbar dupla.
const COR = { E: "#0b4f9c", M: "#10a07a", D: "#e0a100", "?": "#8e4ec6" };
const NOME_GESTAO = { E: "Gestão estadual", M: "Gestão municipal", D: "Gestão dupla (estadual e municipal)", "?": "Gestão não informada" };

// Limites do Maranhão: o mapa só mostra o estado (o resto do Brasil fica esmaecido e a navegação é presa ao MA).
const ANEIS_MA = CONTORNO_MA.geometry.coordinates.flatMap(poligono => poligono.map(anel => anel.map(([lng, lat]) => [lat, lng])));
const LIMITES_MA = L.latLngBounds(ANEIS_MA.flat());
const mapa = L.map("mapa", { zoomControl: true, zoomSnap: 0.25, maxBounds: LIMITES_MA.pad(0.3), maxBoundsViscosity: 1 });
mapa.fitBounds(LIMITES_MA, { padding: [10, 10] });
mapa.setMinZoom(mapa.getZoom() - 0.5);   // não afasta tanto a ponto de sair do estado
// Fundo único: ruas do OpenStreetMap em tons de cinza (gratuito, sem chave de API).
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "tile-cinza", attribution: "© OpenStreetMap" }).addTo(mapa);
// Máscara: tudo fora do MA esmaecido + contorno azul do estado (sem capturar cliques).
mapa.createPane("mascara"); mapa.getPane("mascara").style.zIndex = 350; mapa.getPane("mascara").style.pointerEvents = "none";
const MUNDO = [[-60, -110], [-60, 10], [30, 10], [30, -110]];   // [lat, lng]: bem maior que a área visível
L.polygon([MUNDO, ...ANEIS_MA], { pane: "mascara", interactive: false, stroke: false, fillColor: "#e4e9ee", fillOpacity: .82 }).addTo(mapa);
L.polygon(ANEIS_MA, { pane: "mascara", interactive: false, fill: false, color: "#0b4f9c", weight: 2.5, opacity: .9, lineJoin: "round" }).addTo(mapa);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);
const camadaPontos = L.layerGroup().addTo(mapa);
const camadaRota = L.layerGroup().addTo(mapa);
const pontos = new Map();

const temCoordenada = e => Number.isFinite(e.lat) && Number.isFinite(e.lng) && e.lat !== 0 && e.lng !== 0;

// Marcador = o símbolo do Saudinho (pino com cruz), na cor da gestão da unidade.
const PINO = "M32 10a14 14 0 0 0-14 14c0 10 14 28 14 28s14-18 14-28a14 14 0 0 0-14-14zM30 18h4v5h5v4h-5v5h-4v-5h-5v-4h5z";
function iconePino(cor, grande) {
  const w = grande ? 40 : 30, h = Math.round(w * 50 / 36);
  return L.divIcon({
    className: "pino" + (grande ? " pino-sel" : ""), iconSize: [w, h], iconAnchor: [w / 2, h - 2], tooltipAnchor: [w / 2 - 2, -h / 2],
    html: `<svg viewBox="14 6 36 50" width="${w}" height="${h}" aria-hidden="true"><path d="${PINO}" fill="${cor}" fill-rule="evenodd" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/></svg>`,
  });
}

function desenharPontos(lista, aoClicar, ajustar = true) {
  camadaPontos.clearLayers(); camadaRota.clearLayers(); pontos.clear();
  const coords = [];
  for (const e of lista.filter(temCoordenada)) {
    const m = L.marker([e.lat, e.lng], { icon: iconePino(COR[e.gestao]), title: e.nome, keyboard: true, riseOnHover: true });
    m.bindTooltip(e.nome, { direction: "right" });
    m.on("click", () => aoClicar(e));
    m.addTo(camadaPontos); pontos.set(e.cnes, { m, e }); coords.push([e.lat, e.lng]);
  }
  if (ajustar && coords.length) mapa.fitBounds(coords, { padding: [50, 50], maxZoom: 15 });
}

function destacar(e) {
  pontos.forEach(({ m, e: u }, cnes) => { const sel = cnes === e.cnes; m.setIcon(iconePino(COR[u.gestao], sel)); m.setZIndexOffset(sel ? 1000 : 0); });
  if (temCoordenada(e)) mapa.flyTo([e.lat, e.lng], 15, { duration: 0.6 });
}

function desenharRota(rota, origem) {
  camadaRota.clearLayers();
  const linha = L.geoJSON(rota.geometry, { style: { color: "#0b4f9c", weight: 6, opacity: .9 } }).addTo(camadaRota);
  L.circleMarker([origem.lat, origem.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#10243a", fillOpacity: 1 })
    .bindTooltip("Você está aqui").addTo(camadaRota);
  mapa.fitBounds(linha.getBounds(), { padding: [50, 50] });
}

// Tabela no mapa: gestão, órgão responsável e quantidade de unidades (atualizada a cada busca).
function orgaoDe(k, municipio) {
  const mun = municipio ? "Secretaria Municipal de Saúde de " + municipio : "Secretaria Municipal de Saúde";
  return { E: "Secretaria de Estado da Saúde (SES-MA)", M: mun, D: "SES-MA e " + mun, "?": "Não informado no CNES" }[k];
}
function pinoSvg(cor) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "14 6 36 50"); svg.setAttribute("width", "13"); svg.setAttribute("height", "18");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", PINO); p.setAttribute("fill", cor); p.setAttribute("fill-rule", "evenodd");
  svg.appendChild(p); return svg;
}
const legenda = L.control({ position: "bottomright" });
let legendaCaixa = null, legendaDados = { itens: [], municipio: "" }, legendaAberta = true;
legenda.onAdd = () => {
  legendaCaixa = L.DomUtil.create("div", "legenda"); legendaCaixa.setAttribute("aria-label", "Órgãos responsáveis pelas unidades");
  L.DomEvent.disableClickPropagation(legendaCaixa); L.DomEvent.disableScrollPropagation(legendaCaixa);
  desenharLegenda(); return legendaCaixa;
};
function desenharLegenda() {
  if (!legendaCaixa) return;
  const { itens, municipio } = legendaDados, filtroAtual = legendaDados.filtro || "";
  legendaCaixa.replaceChildren();
  const topo = el("button", null, "legenda-topo"); topo.type = "button"; topo.setAttribute("aria-expanded", String(legendaAberta));
  topo.append(el("strong", "Órgãos responsáveis"), el("span", legendaAberta ? "−" : "+", "legenda-sinal"));
  topo.addEventListener("click", () => { legendaAberta = !legendaAberta; desenharLegenda(); });
  legendaCaixa.appendChild(topo);
  if (!legendaAberta) return;
  const tab = document.createElement("table"); tab.className = "legenda-tab";
  const cab = tab.createTHead().insertRow(); ["Gestão", "Órgão responsável", "Un."].forEach(t => cab.appendChild(el("th", t)));
  const corpo = tab.createTBody();
  for (const k of ["E", "M", "D", "?"]) {
    const n = itens.filter(e => e.gestao === k).length;
    if (k === "?" && !n && itens.length) continue;
    const tr = corpo.insertRow(); if (filtroAtual === k) tr.className = "ativa";
    const c1 = tr.insertCell(); c1.append(pinoSvg(COR[k]), el("span", NOME_GESTAO[k].replace(" (estadual e municipal)", "")));
    tr.insertCell().textContent = orgaoDe(k, municipio);
    const c3 = tr.insertCell(); c3.textContent = itens.length ? n : "–"; c3.className = "num";
  }
  legendaCaixa.appendChild(tab);
  if (itens.length) legendaCaixa.appendChild(el("p", itens.length + " unidades ativas" + (municipio ? " em " + municipio : ""), "legenda-total"));
}
function atualizarLegenda(itens, municipio, filtro) { legendaDados = { itens, municipio: municipio || "", filtro: filtro || "" }; desenharLegenda(); }
legenda.addTo(mapa);
