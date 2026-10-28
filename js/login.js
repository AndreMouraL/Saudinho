(async () => {
  const erro = $("erro"), btn = $("btn");
  ativarOlho();
  try { if (await carregarSessao()) return location.replace("index.html"); }
  catch (e) { mostrarErro(erro, e.message); }

  $("form-login").addEventListener("submit", async ev => {
    ev.preventDefault(); erro.hidden = true;
    const email = $("email").value.trim(), senha = $("senha").value;
    if (!email || !senha) return mostrarErro(erro, "Informe e-mail e senha.");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      await chamarBackend("backend/auth.php?acao=login", { metodo: "POST", corpo: { email, senha } });
      location.replace("index.html");
    } catch (e) { mostrarErro(erro, e.message); btn.disabled = false; btn.textContent = "Entrar"; }
  });
})();
