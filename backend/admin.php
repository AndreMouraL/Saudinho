<?php
// Gestão de usuários (somente administradores).
require __DIR__ . '/recuperacao.php';
$eu = exigir_admin();
$acao = $_GET['acao'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $acao === 'listar') {
    responder(200, ['usuarios' => array_map('publico', usuarios_ler())]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(405, ['erro' => 'Método não permitido.']);
exigir_csrf();
$d = entrada();
$id = (string) ($d['id'] ?? '');
if ($id === $eu['id']) responder(400, ['erro' => 'Você não pode alterar a própria conta por aqui.']);

if ($acao === 'link_senha') {   // o administrador gera o link para a pessoa (útil sem servidor de e-mail)
    foreach (usuarios_ler() as $u) if ($u['id'] === $id) responder(200, ['link' => criar_link_recuperacao($id), 'minutos' => VALIDADE_TOKEN / 60]);
    responder(404, ['erro' => 'Usuário não encontrado.']);
}

usuarios_alterar(function (array &$lista) use ($acao, $id, $d) {
    $idx = null;
    foreach ($lista as $i => $u) if ($u['id'] === $id) { $idx = $i; break; }
    if ($idx === null) responder(404, ['erro' => 'Usuário não encontrado.']);
    switch ($acao) {
        case 'papel':
            $p = (string) ($d['papel'] ?? '');
            if (!in_array($p, ['admin', 'usuario'], true)) responder(400, ['erro' => 'Papel inválido.']);
            $lista[$idx]['papel'] = $p;
            break;
        case 'ativo':
            $lista[$idx]['ativo'] = (bool) ($d['ativo'] ?? false);
            break;
        case 'excluir':
            array_splice($lista, $idx, 1);
            break;
        default:
            responder(404, ['erro' => 'Ação desconhecida.']);
    }
});
responder(200, ['ok' => true]);
