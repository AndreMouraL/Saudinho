<?php
declare(strict_types=1);
require_once __DIR__ . '/base.php';

// Primeira linha do arquivo de usuários: faz o PHP encerrar com 404 se alguém abrir o arquivo pelo navegador.
const PREFIXO = "<?php http_response_code(404); exit; ?>\n";

session_name('saudema');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function entrada(): array {
    $j = json_decode(file_get_contents('php://input') ?: '[]', true);
    return is_array($j) ? $j : [];
}

// Token anti-CSRF: o JavaScript o recebe em auth.php?acao=eu e o envia em todo POST.
function csrf(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function exigir_csrf(): void {
    if (!hash_equals(csrf(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        responder(403, ['erro' => 'Sessão expirada. Recarregue a página e tente de novo.']);
    }
}

function usuarios_ler(): array {
    $f = config('dados');
    if (!is_file($f)) return [];
    $txt = substr((string) file_get_contents($f), strlen(PREFIXO));
    return json_decode($txt, true) ?: [];
}

// Lê, altera e grava a lista de usuários com trava de arquivo (evita corrida entre requisições).
function usuarios_alterar(callable $fn) {
    $f = config('dados');
    if (!is_dir(dirname($f))) mkdir(dirname($f), 0775, true);
    $fp = fopen($f, 'c+');
    if (!$fp) responder(500, ['erro' => 'Não consegui gravar em backend/data/. Verifique as permissões da pasta.']);
    flock($fp, LOCK_EX);
    $lista = json_decode(substr((string) stream_get_contents($fp), strlen(PREFIXO)), true) ?: [];
    $resultado = $fn($lista);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, PREFIXO . json_encode($lista, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $resultado;
}

// Dados do usuário que podem ir para o navegador (nunca o hash da senha).
function publico(array $u): array {
    return ['id' => $u['id'], 'nome' => $u['nome'], 'email' => $u['email'], 'papel' => $u['papel'],
            'perfil' => $u['perfil'], 'ativo' => $u['ativo'], 'criado' => $u['criado'], 'ultimoAcesso' => $u['ultimoAcesso'] ?? null];
}

function usuario_logado(): ?array {
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return null;
    foreach (usuarios_ler() as $u) if ($u['id'] === $id && $u['ativo']) return $u;
    return null;
}
function exigir_login(): array {
    $u = usuario_logado();
    if (!$u) responder(401, ['erro' => 'Faça login para continuar.']);
    return $u;
}
function exigir_admin(): array {
    $u = exigir_login();
    if ($u['papel'] !== 'admin') responder(403, ['erro' => 'Acesso restrito a administradores.']);
    return $u;
}
