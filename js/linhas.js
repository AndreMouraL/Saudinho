// Transforma estabelecimentos e profissionais em linhas planas (uma coluna por informação), usadas na base JSON e na planilha XLSX.
// Depende de api.js (campo, horarioDe, complexidadeDe, formatarCnpj…).
const GESTAO_TXT = { E: "Estadual", M: "Municipal", D: "Dupla", "?": "Não informada" };
const COLUNAS_ESTAB = ["cnes", "nome_fantasia", "razao_social", "cnpj", "tipo_unidade", "subtipo_unidade", "gestao", "natureza_juridica_codigo",
  "logradouro", "numero", "complemento", "bairro", "cep", "municipio", "codigo_municipio", "uf", "telefone", "email", "latitude", "longitude",
  "funciona_24h", "horario_funcionamento", "complexidade", "complexidade_origem", "qtd_profissionais", "atualizado_em", "link_cnes"];
const COLUNAS_PROF = ["cnes", "estabelecimento", "municipio", "nome", "ocupacao", "cbo", "codigo_profissional", "vinculo", "carga_horaria_semanal",
  "ch_ambulatorial", "ch_hospitalar", "ch_outros"];
// Nomes legíveis das colunas na planilha.
const TITULOS = { cnes: "CNES", nome_fantasia: "Nome fantasia", razao_social: "Razão social", cnpj: "CNPJ", tipo_unidade: "Tipo de unidade", subtipo_unidade: "Subtipo",
  gestao: "Gestão", natureza_juridica_codigo: "Natureza jurídica (código)", logradouro: "Logradouro", numero: "Número", complemento: "Complemento", bairro: "Bairro",
  cep: "CEP", municipio: "Município", codigo_municipio: "Código do município", uf: "UF", telefone: "Telefone", email: "E-mail", latitude: "Latitude", longitude: "Longitude",
  funciona_24h: "Funciona 24 h", horario_funcionamento: "Horário de funcionamento", complexidade: "Complexidade", complexidade_origem: "Origem da complexidade",
  qtd_profissionais: "Qtd. de profissionais", atualizado_em: "Atualizado em", link_cnes: "Ficha no CNES",
  estabelecimento: "Estabelecimento", nome: "Nome do profissional", ocupacao: "Ocupação", cbo: "CBO", codigo_profissional: "Código do profissional", vinculo: "Vínculo",
  carga_horaria_semanal: "Carga horária semanal", ch_ambulatorial: "CH ambulatorial", ch_hospitalar: "CH hospitalar", ch_outros: "CH outros" };

function linhaEstab(e, municipioNome, qtdProf, codMunicipio) {
  // A lista do portal traz poucos campos; endereço, tipo, telefone e "Sempre aberto" vêm da ficha (já mesclada em e.bruto por fichaDe).
  const b = e.bruto, h = horarioDe(e), c = complexidadeDe(e, campo(b, "dsTpUnidade", "descricao_tipo_unidade", "dsTipoEstabelecimento"));
  const cod6 = String(campo(b, "municipio", "codigo_municipio") || codMunicipio || "").slice(0, 6);
  const sete = String(parseInt(e.cnes, 10) || 0).padStart(7, "0");
  const sempre = String(campo(b, "tpSempreAberto", "sempre_aberto")).trim().toUpperCase();
  const lat = numero(campo(b, "nuLatitude", "latitude_estabelecimento_decimo_grau", "latitude") || e.lat), lng = numero(campo(b, "nuLongitude", "longitude_estabelecimento_decimo_grau", "longitude") || e.lng);
  const cnpj = campo(b, "cnpj", "numero_cnpj_entidade", "numero_cnpj"), cep = campo(b, "cep", "codigo_cep_estabelecimento", "nuCep");
  const gest = gestaoDe(b);
  return {
    cnes: sete, nome_fantasia: e.nome === "(sem nome)" ? "" : e.nome, razao_social: campo(b, "noEmpresarial", "nome_razao_social", "razao_social"),
    cnpj: cnpj ? formatarCnpj(cnpj) : "", tipo_unidade: frase(campo(b, "dsTpUnidade", "descricao_tipo_unidade", "dsTipoEstabelecimento")),
    subtipo_unidade: frase(campo(b, "dsStpUnidade")), gestao: GESTAO_TXT[gest !== "?" ? gest : e.gestao] || "Não informada", natureza_juridica_codigo: String(campo(b, "natJuridica", "natureza_juridica")),
    logradouro: campo(b, "noLogradouro", "endereco_estabelecimento", "logradouro"), numero: String(campo(b, "nuEndereco", "numero_estabelecimento", "numero")), complemento: campo(b, "noComplemento", "complemento"),
    bairro: campo(b, "bairro", "bairro_estabelecimento"), cep: cep ? formatarCep(cep) : "", municipio: municipioNome || campo(b, "noMunicipio"), codigo_municipio: cod6, uf: campo(b, "uf") || "MA",
    telefone: campo(b, "nuTelefone", "numero_telefone_estabelecimento", "telefone"), email: campo(b, "noEmail", "endereco_email_estabelecimento", "email"),
    latitude: Number.isFinite(lat) ? lat : "", longitude: Number.isFinite(lng) ? lng : "",
    funciona_24h: sempre === "S" ? "Sim" : sempre === "N" ? "Não" : "Não informado",
    horario_funcionamento: h.texto, complexidade: c.texto, complexidade_origem: c.obs || "",
    qtd_profissionais: qtdProf == null ? "" : qtdProf, atualizado_em: campo(b, "dtAtualizacao", "data_atualizacao") || "",
    link_cnes: cod6 ? "https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/identificacao/" + cod6 + sete : "",
  };
}

function linhaProf(p, estabRow) {
  const r = p.bruto || {}, num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : ""; };
  return {
    cnes: estabRow.cnes, estabelecimento: estabRow.nome_fantasia, municipio: estabRow.municipio, nome: p.nome || "", ocupacao: p.ocupacao === "Não informada" ? "" : p.ocupacao,
    cbo: p.cbo, codigo_profissional: p.codigo, vinculo: p.vinculo, carga_horaria_semanal: p.carga || "",
    ch_ambulatorial: num(r.chAmb), ch_hospitalar: num(r.chHosp), ch_outros: num(r.chOutros),
  };
}
