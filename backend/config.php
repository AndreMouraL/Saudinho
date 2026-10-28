<?php
// Configurações do back-end.
return [
    // Se aparecer "SSL certificate ... self-signed certificate in certificate chain",
    // o antivírus/rede inspeciona HTTPS. Solução correta: baixar https://curl.se/ca/cacert.pem
    // e salvar em backend/cacert.pem. Solução rápida (SÓ em testes locais): trocar para false.
    'verificar_ssl' => true,
    'cacert' => __DIR__ . '/cacert.pem',
    // Último recurso, SÓ em localhost: se mesmo assim o certificado falhar, tenta sem verificar.
    'ssl_inseguro_local' => true,
    // Cadastro de usuários (arquivo protegido: se acessado pelo navegador, responde 404).
    'dados' => __DIR__ . '/data/usuarios.json.php',
    // Links de recuperação de senha (só o hash do token é guardado).
    'recuperacao' => __DIR__ . '/data/recuperacao.json.php',
    // Enviar o link por e-mail com mail() do PHP (precisa de servidor de e-mail configurado no php.ini).
    'enviar_email' => false,
    // Em localhost (sem e-mail), mostra o link na própria tela para você testar. Nunca vale fora do localhost.
    'mostrar_link_local' => true,
];
