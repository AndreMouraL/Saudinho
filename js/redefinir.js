(async () => {
  const erro = $("erro"), btn = $("btn");
  ativarOlho();
  const token = new URLSearchParams(location.search).get("token") || "";
  try { await carregarSessao(); } catch (e) { mostrarErro(erro, e.message); }
  if (!/^[a-f0-9]{64}$/.test(token)) {
    mostrarErro(erro, "Link inválido ou incompleto. Peça um novo em “Esqueci minha senha”.");
    $("form-red").querySelectorAll("input,button[type=submit]").forEach(x => x.disabled = true); return;
  }
  const forca = s => [s.length >= 8, s.length >= 12, /[a-z]/.test(s) && /[A-Z]/.test(s), /\d/.test(s), /[^A-Za-z0-9]/.test(s)].filter(Boolean).length;
  $("senha").addEventListener("input", () => {
    const v = $("senha").value, n = forca(v);
    $("barra").style.width = (v ? (n / 5) * 100 : 0) + "%";
    $("barra").style.background = ["#b3261e", "#b3261e", "#e0a100", "#e0a100", "#10a07a", "#0a7558"][n];
    $("forca-texto").textContent = v ? "Força da senha: " + ["Muito fraca", "Fraca", "Razoável", "Razoável", "Boa", "Forte"][n] : "Mínimo de 8 caracteres, com letras e números.";
  });
  $("form-red").addEventListener("submit", async ev => {
    ev.preventDefault(); erro.hidden = true;
    const senha = $("senha").value;
    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return mostrarErro(erro, "A senha precisa ter 8 ou mais caracteres, com letras e números.");
    if (senha !== $("senha2").value) return mostrarErro(erro, "As senhas não são iguais.");
    btn.disabled = true; btn.textContent = "Salvando…";
    try {
      await chamarBackend("backend/auth.php?acao=redefinir", { metodo: "POST", corpo: { token, senha } });
      toast("Senha alterada! Entre com a nova senha.", "ok");
      setTimeout(() => location.replace("login.html"), 1200);
    } catch (e) { mostrarErro(erro, e.message); btn.disabled = false; btn.textContent = "Salvar nova senha"; }
  });
})();
