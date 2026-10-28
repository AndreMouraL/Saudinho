<?php
// Lista os 217 municípios do Maranhão (IBGE), com cache de 1 dia em backend/cache/.
require __DIR__ . '/http.php';
header("Content-Type: application/json; charset=utf-8");

$arquivo = __DIR__ . '/cache/municipios.json';
if (is_file($arquivo) && time() - filemtime($arquivo) < 86400) {
    readfile($arquivo);
    exit;
}

[$status, $corpo] = buscar('https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios');
$lista = json_decode($corpo, true);
if ($status !== 200 || !is_array($lista)) {
    http_response_code(502);
    echo json_encode(['erro' => 'IBGE indisponível']);
    exit;
}

$saida = [];
foreach ($lista as $m) {
    // O CNES usa o código IBGE com 6 dígitos (sem o dígito verificador).
    $saida[] = ['nome' => $m['nome'], 'codigo' => substr((string)$m['id'], 0, 6)];
}
usort($saida, fn($a, $b) => strcmp($a['nome'], $b['nome']));
$json = json_encode($saida, JSON_UNESCAPED_UNICODE);
@file_put_contents($arquivo, $json);
echo $json;
