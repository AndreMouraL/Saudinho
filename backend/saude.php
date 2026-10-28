<?php
// Proxy da API de Dados Abertos do Ministério da Saúde (só para usuários logados).
require __DIR__ . '/sessao.php';
require __DIR__ . '/http.php';
exigir_login();

// Só repassa rotas conhecidas (evita que o servidor vire um proxy aberto).
const PERMITIDAS = ['/cnes/estabelecimentos', '/cnes/tipounidades', '/assistencia-a-saude/cnes-profissionais',
    '/assistencia-a-saude/cnes-servicos-especializados', '/cnes/profissionais', '/assistencia-a-saude/hospitais-e-leitos'];

$rota = $_GET['rota'] ?? '';

// Fonte 2: o próprio portal do CNES (cnes.datasus.gov.br), que lista TODOS os profissionais da unidade, com nome.
// O identificador é o código do município (6 dígitos) + o CNES (7 dígitos), ou só o CNES.
if (preg_match('#^/portal/profissionais/(\d{7}|\d{13})$#', $rota, $m)) {
    $url = 'https://cnes.datasus.gov.br/services/estabelecimentos-profissionais/' . $m[1];
    if (!empty($_GET['comp']) && preg_match('/^\d{6}$/', $_GET['comp'])) $url .= '?comp=' . $_GET['comp'];
    [$status, $corpo] = buscar($url);
    http_response_code($status);
    echo $corpo;
    exit;
}

// Cache em disco: respostas boas ficam 6 h (menos chamadas = menos risco de o Ministério bloquear o seu IP)
// e, se a origem cair, a última resposta boa é servida mesmo vencida (cabeçalho X-Cache: stale).
function servir(string $url): void {
    $pasta = __DIR__ . '/cache/api'; $arq = $pasta . '/' . md5($url) . '.json';
    if (is_file($arq) && time() - filemtime($arq) < 6 * 3600) { header('X-Cache: hit'); echo file_get_contents($arq); exit; }
    [$status, $corpo] = buscar($url);
    $json = json_decode($corpo, true);
    if ($status === 200 && is_array($json) && $json) {
        if (!is_dir($pasta)) @mkdir($pasta, 0775, true);
        @file_put_contents($arq, $corpo);
    } elseif (is_file($arq)) { header('X-Cache: stale'); echo file_get_contents($arq); exit; }
    http_response_code($status);
    echo $corpo;
    exit;
}

// Fonte 1: portal do CNES (mesma base das telas "Consulta Estabelecimento" e "Consulta Profissional" do site).
// Só as consultas abaixo são repassadas; os parâmetros vão como vieram (município, UF, pesquisa…).
// /portal/estabelecimentos/{município+CNES, 13 dígitos} devolve a ficha completa (com nuLatitude/nuLongitude).
if (preg_match('#^/portal/(estabelecimentos|profissionais)(/\d{13})?$#', $rota, $m)) {
    $params = $_GET; unset($params['rota']);
    servir('https://cnes.datasus.gov.br/services/' . $m[1] . ($m[2] ?? '') . ($params ? '?' . http_build_query($params) : ''));
}
if (!in_array($rota, PERMITIDAS, true)) responder(400, ['erro' => 'Rota não permitida']);

$params = $_GET;
unset($params['rota']);
if (isset($params['limit'])) $params['limit'] = min(20, max(1, (int) $params['limit']));   // regra da API: no máximo 20

servir('https://apidadosabertos.saude.gov.br' . $rota . '?' . http_build_query($params));
