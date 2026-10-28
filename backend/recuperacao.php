<?php
// Recuperação de senha: gera um link de uso único (válido por 30 minutos) e troca a senha.
// Só o hash (SHA-256) do token fica gravado; quem ler o arquivo não consegue usar os links.
require_once __DIR__ . '/sessao.php';

const VALIDADE_TOKEN = 1800;

function tokens_alterar(callable $fn) {
    $f = config('recuperacao');
    if (!is_dir(dirname($f))) mkdir(dirname($f), 0775, true);
    $fp = fopen($f, 'c+');
    if (!$fp) responder(500, ['erro' => 'Não consegui gravar em backend/data/. Verifique as permissões da pasta.']);
    flock($fp, LOCK_EX);
    $lista = json_decode(substr((string) stream_get_contents($fp), strlen(PREFIXO)), true) ?: [];
    $lista = array_values(array_filter($lista, fn($t) => $t['expira'] > time()));   // descarta vencidos
    $resultado = $fn($lista);
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, PREFIXO . json_encode($lista, JSON_PRETTY_PRINT));
    fflush($fp); flock($fp, LOCK_UN); fclose($fp);
    return $resultado;
}

// Cria um token novo para o usuário (o anterior deixa de valer) e devolve o link completo.
function criar_link_recuperacao(string $uid): string {
    $token = bin2hex(random_bytes(32));
    tokens_alterar(function (array &$lista) use ($uid, $token) {
        $lista = array_values(array_filter($lista, fn($t) => $t['uid'] !== $uid));
        $lista[] = ['uid' => $uid, 'hash' => hash('sha256', $token), 'expira' => time() + VALIDADE_TOKEN];
    });
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $pasta = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/backend/x.php')), '/\\');
    return $https . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $pasta . '/redefinir.html?token=' . $token;
}

function e_local(): bool {
    return in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
}

function senha_valida(string $s): bool {
    return strlen($s) >= 8 && preg_match('/[A-Za-z]/', $s) && preg_match('/\d/', $s);
}
