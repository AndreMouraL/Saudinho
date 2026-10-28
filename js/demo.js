// PLANO B: dados de demonstração, usados somente se o back-end/API não responder.
const DEMO = {
  estabelecimentos: [
    {codigo_cnes:"0000001", nome_fantasia:"Hospital de exemplo", tipo_gestao:"E", codigo_municipio:"211130", endereco_estabelecimento:"Endereço de exemplo", descricao_turno_atendimento:"Atendimento contínuo (24 h)", latitude_estabelecimento_decimo_grau:-2.5307, longitude_estabelecimento_decimo_grau:-44.2989},
    {codigo_cnes:"0000002", nome_fantasia:"UBS de exemplo", tipo_gestao:"M", codigo_municipio:"211130", endereco_estabelecimento:"Endereço de exemplo", descricao_turno_atendimento:"Manhã e tarde", latitude_estabelecimento_decimo_grau:-2.5391, longitude_estabelecimento_decimo_grau:-44.2825},
    {codigo_cnes:"0000003", nome_fantasia:"Policlínica de exemplo", tipo_gestao:"D", codigo_municipio:"211130", endereco_estabelecimento:"Endereço de exemplo", descricao_turno_atendimento:"Manhã e tarde", latitude_estabelecimento_decimo_grau:-2.5512, longitude_estabelecimento_decimo_grau:-44.2431},
    {codigo_cnes:"0000004", nome_fantasia:"Unidade sem gestão informada (exemplo)", codigo_municipio:"211130", endereco_estabelecimento:"Endereço de exemplo", latitude_estabelecimento_decimo_grau:-2.5600, longitude_estabelecimento_decimo_grau:-44.2700}
  ],
  profissionais: [
    {descricao_cbo:"Médico clínico", codigo_cbo:"225125", carga_horaria:"20", codigo_cnes:"0000001"},
    {descricao_cbo:"Enfermeiro", codigo_cbo:"223505", carga_horaria:"30", codigo_cnes:"0000001"},
    {descricao_cbo:"Técnico de enfermagem", codigo_cbo:"322205", carga_horaria:"36", codigo_cnes:"0000001"}
  ],
  leitos: [
    {descricao_tipo_leito:"Clínico - Clínica geral", quantidade_existente:"40", quantidade_sus:"32", codigo_cnes:"0000001"},
    {descricao_tipo_leito:"Cirúrgico - Cirurgia geral", quantidade_existente:"25", quantidade_sus:"20", codigo_cnes:"0000001"},
    {descricao_tipo_leito:"Complementar - UTI adulto", quantidade_existente:"10", quantidade_sus:"10", codigo_cnes:"0000001"}
  ],
  servicos: [
    {descricao_servico_especializado:"Serviço de Urgência e Emergência", descricao_classificacao_servico:"Pronto atendimento"},
    {descricao_servico_especializado:"Serviço de Diagnóstico por Imagem", descricao_classificacao_servico:"Radiologia"},
    {descricao_servico_especializado:"Serviço de Laboratório Clínico", descricao_classificacao_servico:"Análises clínicas"}
  ]
};
