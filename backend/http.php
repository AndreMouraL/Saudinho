<?php
require_once __DIR__ . '/base.php';

const UA_NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Executa um GET com cURL e devolve [status, corpo, errno, erro].
function _curl_get(string $url, array $extra): array {
    $portal = str_contains($url, 'cnes.datasus.gov.br');
    $cab = ['Accept: application/json, text/plain, */*', 'Accept-Language: pt-BR,pt;q=0.9',
            'Referer: ' . ($portal ? 'https://cnes.datasus.gov.br/pages/estabelecimentos/consulta.jsp' : 'https://apidadosabertos.saude.gov.br/')];
    $c = curl_init($url);
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_ENCODING => '', CURLOPT_USERAGENT => UA_NAVEGADOR, CURLOPT_HTTPHEADER => $cab,
    ] + $extra);
    $corpo = curl_exec($c);
    $res = [curl_getinfo($c, CURLINFO_HTTP_CODE), $corpo, curl_errno($c), curl_error($c)];
    curl_close($c);
    return $res;
}

// "Connection was reset" (erro 56) costuma ser o servidor do Ministério (ou um firewall/antivírus) derrubando
// a conexão HTTP/2 ou IPv6 do cURL. Por isso tentamos, em ordem, jeitos diferentes de conectar.
function _variantes_conexao(): array {
    $v11 = defined('CURL_HTTP_VERSION_1_1') ? CURL_HTTP_VERSION_1_1 : 2;
    $v4  = defined('CURL_IPRESOLVE_V4') ? CURL_IPRESOLVE_V4 : 1;
    $t12 = defined('CURL_SSLVERSION_TLSv1_2') ? CURL_SSLVERSION_TLSv1_2 : 6;
    return [
        'http1.1+ipv4'      => [CURLOPT_HTTP_VERSION => $v11, CURLOPT_IPRESOLVE => $v4],
        'http1.1+ipv4+tls1.2' => [CURLOPT_HTTP_VERSION => $v11, CURLOPT_IPRESOLVE => $v4, CURLOPT_SSLVERSION => $t12, CURLOPT_FRESH_CONNECT => true, CURLOPT_FORBID_REUSE => true],
        'padrao'            => [],
    ];
}

// Faz uma tentativa tratando o erro de certificado (cacert.pem -> certificados do sistema -> sem verificar só em localhost).
function _tentar(string $url, array $variante): array {
    if (!config('verificar_ssl')) {
        return _curl_get($url, $variante + [CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);
    }
    $base = is_file((string) config('cacert')) ? [CURLOPT_CAINFO => config('cacert')] : [];
    $r = _curl_get($url, $variante + $base);
    if ($r[1] === false && in_array($r[2], [58, 60, 77], true)) $r = _curl_get($url, $variante + [CURLOPT_SSL_OPTIONS => 16]);   // NATIVE_CA
    $local = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1', '::1'], true);
    if ($r[1] === false && in_array($r[2], [58, 60, 77], true) && config('ssl_inseguro_local') && $local) {
        $r = _curl_get($url, $variante + [CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);
    }
    return $r;
}

// GET simples: devolve [status, corpo]. $log (opcional) recebe o resultado de cada tentativa (usado no diagnóstico).
function buscar(string $url, ?array &$log = null): array {
    $log = [];
    $ultimo = [0, false, 0, 'sem tentativa'];
    if (function_exists('curl_init')) {
        foreach (_variantes_conexao() as $nome => $variante) {
            for ($t = 0; $t < 2; $t++) {                       // 2 tentativas por variante (a API do Ministério oscila)
                $ultimo = _tentar($url, $variante);
                $log[] = ['variante' => $nome, 'tentativa' => $t + 1, 'status' => $ultimo[0], 'errno' => $ultimo[2], 'erro' => $ultimo[3]];
                if ($ultimo[1] !== false && $ultimo[0] > 0 && $ultimo[0] < 500) return [$ultimo[0], $ultimo[1]];
                if (in_array($ultimo[2], [58, 60, 77], true)) break 2;   // certificado: outra variante não resolve
                usleep(350000);
            }
        }
        if ($ultimo[1] !== false && $ultimo[0] > 0) return [$ultimo[0], $ultimo[1]];   // 5xx do servidor: devolve como veio
    }
    // Último recurso: fluxo nativo do PHP (usa outra pilha de rede, que às vezes passa onde o cURL é derrubado).
    if (ini_get('allow_url_fopen')) {
        $verificar = (bool) config('verificar_ssl');
        $ctx = stream_context_create([
            'http' => ['timeout' => 30, 'ignore_errors' => true, 'protocol_version' => 1.1,
                       'header' => "Accept: application/json\r\nUser-Agent: " . UA_NAVEGADOR . "\r\nConnection: close\r\n"],
            'ssl' => ['verify_peer' => $verificar, 'verify_peer_name' => $verificar],
        ]);
        $corpo = @file_get_contents($url, false, $ctx);
        $log[] = ['variante' => 'stream-php', 'tentativa' => 1, 'status' => $corpo === false ? 0 : 200, 'errno' => 0, 'erro' => $corpo === false ? (error_get_last()['message'] ?? 'falha') : ''];
        if ($corpo !== false) {
            preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0] ?? '', $m);
            return [(int) ($m[1] ?? 200), $corpo];
        }
    }
    $en = $ultimo[2];
    $dica = in_array($en, [58, 60, 77], true)
        ? ' | Certificado SSL não confiável neste computador. Baixe https://curl.se/ca/cacert.pem para backend/cacert.pem ou, só em testes locais, use ssl_inseguro_local = true em backend/config.php.'
        : '';
    return [502, json_encode(['erro' => 'Falha de rede: ' . ($ultimo[3] ?: 'sem resposta') . $dica, 'origem' => 'rede'], JSON_UNESCAPED_UNICODE)];
}
