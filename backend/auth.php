<?php
// Cadastro, login, logout e consulta da sessão.
require __DIR__ . '/recuperacao.php';

$acao = $_GET['acao'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

if ($acao === 'eu' && $metodo === 'GET') {
    $u = usuario_logado();
    // Só o nome dos administradores ativos (sem e-mail) vai para quem está logado, para saber a quem pedir acesso.
    $admins = $u ? array_values(array_map(fn($a) => $a['nome'], array_filter(usuarios_ler(), fn($a) => ($a['papel'] ?? '') === 'admin' && !empty($a['ativo'])))) : [];
    responder(200, ['logado' => (bool) $u, 'usuario' => $u ? publico($u) : null, 'admins' => $admins, 'csrf' => csrf()]);
}
if ($metodo !== 'POST') responder(405, ['erro' => 'Método não permitido.']);
exigir_csrf();
$d = entrada();

const PERFIS = ['Profissional de saúde', 'Gestor(a) de saúde', 'Estudante ou pesquisador(a)', 'Cidadão'];

switch ($acao) {
    case 'cadastro':
        $nome = trim((string) ($d['nome'] ?? ''));
        $email = strtolower(trim((string) ($d['email'] ?? '')));
        $senha = (string) ($d['senha'] ?? '');
        $perfil = (string) ($d['perfil'] ?? '');
        if (mb_strlen($nome) < 2 || mb_strlen($nome) > 80) responder(422, ['erro' => 'Informe seu nome (2 a 80 caracteres).']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responder(422, ['erro' => 'E-mail inválido.']);
        if (strlen($senha) < 8 || !preg_match('/[A-Za-z]/', $senha) || !preg_match('/\d/', $senha)) {
            responder(422, ['erro' => 'A senha precisa ter 8 ou mais caracteres, com letras e números.']);
        }
        if (!in_array($perfil, PERFIS, true)) responder(422, ['erro' => 'Escolha um perfil.']);

        $novo = usuarios_alterar(function (array &$lista) use ($nome, $email, $senha, $perfil) {
            foreach ($lista as $u) if ($u['email'] === $email) return null;
            $novo = [
                'id' => bin2hex(random_bytes(8)), 'nome' => $nome, 'email' => $email,
                'senhaHash' => password_hash($senha, PASSWORD_DEFAULT),
                'papel' => count($lista) === 0 ? 'admin' : 'usuario',   // o primeiro cadastro vira administrador
                'perfil' => $perfil, 'ativo' => true, 'criado' => date('c'), 'ultimoAcesso' => date('c'),
            ];
            $lista[] = $novo;
            return $novo;
        });
        if (!$novo) responder(409, ['erro' => 'Já existe uma conta com este e-mail.']);
        session_regenerate_id(true);
        $_SESSION['uid'] = $novo['id'];
        responder(201, ['usuario' => publico($novo), 'csrf' => csrf()]);

    case 'login':
        $email = strtolower(trim((string) ($d['email'] ?? '')));
        $senha = (string) ($d['senha'] ?? '');
        $alvo = null;
        foreach (usuarios_ler() as $u) if ($u['email'] === $email) { $alvo = $u; break; }
        if (!$alvo || !password_verify($senha, $alvo['senhaHash'])) {
            usleep(500000);   // atrasa tentativas erradas
            responder(401, ['erro' => 'E-mail ou senha incorretos.']);
        }
        if (!$alvo['ativo']) responder(403, ['erro' => 'Conta desativada. Fale com o administrador.']);
        usuarios_alterar(function (array &$lista) use ($alvo) {
            foreach ($lista as &$u) if ($u['id'] === $alvo['id']) $u['ultimoAcesso'] = date('c');
        });
        session_regenerate_id(true);
        $_SESSION['uid'] = $alvo['id'];
        responder(200, ['usuario' => publico($alvo), 'csrf' => csrf()]);

    case 'esqueci':
        $email = strtolower(trim((string) ($d['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responder(422, ['erro' => 'Informe um e-mail válido.']);
        $alvo = null;
        foreach (usuarios_ler() as $u) if ($u['email'] === $email && $u['ativo']) { $alvo = $u; break; }
        $resp = ['ok' => true];   // a resposta é a mesma exista ou não a conta (não revela quem está cadastrado)
        if ($alvo) {
            $link = criar_link_recuperacao($alvo['id']);
            if (config('enviar_email')) {
                @mail($alvo['email'], '=?UTF-8?B?' . base64_encode('Saudinho: redefinir senha') . '?=',
                    "Olá, {$alvo['nome']}.\n\nPara criar uma nova senha, abra o link (vale por 30 minutos):\n$link\n\nSe não foi você, ignore esta mensagem.",
                    "Content-Type: text/plain; charset=UTF-8\r\nFrom: Saudinho <no-reply@" . ($_SERVER['SERVER_NAME'] ?? 'localhost') . ">");
            }
            if (config('mostrar_link_local') && e_local()) $resp['link_local'] = $link;
        }
        usleep(300000);
        responder(200, $resp);

    case 'redefinir':
        $token = (string) ($d['token'] ?? '');
        $senha = (string) ($d['senha'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) responder(400, ['erro' => 'Link inválido. Peça um novo.']);
        if (!senha_valida($senha)) responder(422, ['erro' => 'A senha precisa ter 8 ou mais caracteres, com letras e números.']);
        $uid = tokens_alterar(function (array &$lista) use ($token) {
            foreach ($lista as $i => $t) if (hash_equals($t['hash'], hash('sha256', $token))) { array_splice($lista, $i, 1); return $t['uid']; }
            return null;
        });
        if (!$uid) responder(400, ['erro' => 'Link vencido ou já usado. Peça um novo.']);
        usuarios_alterar(function (array &$lista) use ($uid, $senha) {
            foreach ($lista as &$u) if ($u['id'] === $uid) $u['senhaHash'] = password_hash($senha, PASSWORD_DEFAULT);
        });
        responder(200, ['ok' => true]);

    case 'sair':
        $_SESSION = [];
        session_destroy();
        responder(200, ['ok' => true]);

    default:
        responder(404, ['erro' => 'Ação desconhecida.']);
}
