<?php
// Testa a conexão do PHP com as APIs e mostra o que cada jeito de conectar respondeu. Só para usuários logados.
require __DIR__ . '/sessao.php';
require __DIR__ . '/http.php';
exigir_login();

$alvos = [
    'API de Dados Abertos (CNES)' => 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_uf=21&codigo_municipio=211130&status=1&limit=1&offset=0',
    'Portal CNES (estabelecimentos)' => 'https://cnes.datasus.gov.br/services/estabelecimentos?municipio=211130',
    'Portal CNES (profissionais)' => 'https://cnes.datasus.gov.br/services/estabelecimentos-profissionais/2111302400000',
    'IBGE (municípios)'           => 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios',
];
$saida = [
    'php' => PHP_VERSION, 'curl' => function_exists('curl_init') ? (curl_version()['version'] . ' / ' . (curl_version()['ssl_version'] ?? '')) : 'não instalado',
    'allow_url_fopen' => (bool) ini_get('allow_url_fopen'), 'testes' => [],
];
foreach ($alvos as $nome => $url) {
    $t0 = microtime(true);
    [$st, $corpo] = buscar($url, $log);
    $saida['testes'][] = ['alvo' => $nome, 'ok' => $st >= 200 && $st < 300, 'status' => $st, 'ms' => (int) ((microtime(true) - $t0) * 1000),
        'trecho' => mb_substr(preg_replace('/\s+/', ' ', (string) $corpo), 0, 160), 'tentativas' => $log];
}
responder(200, $saida);
