<?php
declare(strict_types=1);

// Lê uma chave de backend/config.php.
function config(string $chave) {
    static $cfg = null;
    $cfg ??= require __DIR__ . '/config.php';
    return $cfg[$chave] ?? null;
}

// Envia uma resposta JSON e encerra.
function responder(int $status, array $dados): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}
