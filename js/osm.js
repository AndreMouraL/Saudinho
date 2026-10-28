// Fonte reserva dos estabelecimentos: OpenStreetMap, via Overpass API (gratuita, sem chave, aceita chamadas do navegador).
// Só entra quando a API do CNES não responde. Não traz profissionais, leitos nem serviços (isso só existe no CNES).
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const TIPOS_OSM = { hospital: "Hospital", clinic: "Clínica / posto de saúde", doctors: "Consultório médico", dentist: "Consultório odontológico",
  centre: "Centro de saúde", laboratory: "Laboratório", doctor: "Consultório médico" };

async function overpass(consulta) {
  let ultimo;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 40000);
      const resp = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(consulta), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctl.signal });
      clearTimeout(t);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return (await resp.json()).elements || [];
    } catch (e) { ultimo = e; }
  }
  throw new Error("OpenStreetMap indisponível (" + (ultimo?.message || "sem resposta") + ")");
}

// Converte um elemento do OSM para o mesmo formato bruto do CNES, para o resto do app funcionar igual.
function brutoDoOsm(el, codMunicipio) {
  const t = el.tags || {}, c = el.center || el;
  const tipo = t.amenity || t.healthcare || "clinic";
  const gestao = /estadual/i.test(t.operator || "") ? "ESTADUAL" : /(municipal|prefeitura|secretaria municipal)/i.test((t.operator || "") + " " + (t.name || "")) ? "MUNICIPAL" : "";
  return {
    codigo_cnes: t["ref:CNES"] || t["ref:cnes"] || ("osm" + el.type[0] + el.id), nome_fantasia: t.name || t["name:pt"] || "",
    codigo_tipo_unidade: tipo, codigo_municipio: codMunicipio, descricao_esfera_administrativa: gestao,
    endereco_estabelecimento: t["addr:street"] || "", numero_estabelecimento: t["addr:housenumber"] || "", bairro_estabelecimento: t["addr:suburb"] || t["addr:neighbourhood"] || "",
    numero_telefone_estabelecimento: t.phone || t["contact:phone"] || "", endereco_email_estabelecimento: t.email || t["contact:email"] || "",
    descricao_turno_atendimento: t.opening_hours || "",
    latitude_estabelecimento_decimo_grau: c.lat, longitude_estabelecimento_decimo_grau: c.lon,
  };
}

async function buscarEstabOSM(nomeMunicipio, codMunicipio) {
  const nome = nomeMunicipio.replace(/"/g, "");
  const q = `[out:json][timeout:35];
area["boundary"="administrative"]["admin_level"="4"]["name"="Maranhão"]->.uf;
area["boundary"="administrative"]["admin_level"="8"]["name"="${nome}"](area.uf)->.m;
(nwr["amenity"~"^(hospital|clinic|doctors|dentist)$"](area.m); nwr["healthcare"~"^(hospital|clinic|centre|doctor|dentist|laboratory)$"](area.m););
out center tags 400;`;
  const els = await overpass(q);
  const vistos = new Set();
  const itens = els.filter(e => (e.tags?.name) && !vistos.has(e.type + e.id) && vistos.add(e.type + e.id) && Number.isFinite((e.center || e).lat))
    .map(e => { const u = normalizarEstab(brutoDoOsm(e, codMunicipio)); u.fonte = "osm"; return u; });
  return itens;
}
