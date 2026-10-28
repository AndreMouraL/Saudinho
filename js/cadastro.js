(async () => {
  const erro = $("erro"), btn = $("btn");
  ativarOlho();
  try { if (await carregarSessao()) return location.replace("index.html"); }
  catch (e) { mostrarErro(erro, e.message); }

  // Medidor simples de força da senha.
  function forca(s) {
    let n = 0;
    if (s.length >= 8) n++;
    if (s.length >= 12) n++;
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++;
    if (/\d/.test(s)) n++;
    if (/[^A-Za-z0-9]/.test(s)) n++;
    return n;
  }
  $("senha").addEventListener("input", () => {
    const n = forca($("senha").value);
    const cores = ["#b3261e", "#b3261e", "#e0a100", "#e0a100", "#10a07a", "#0a7558"];
    const nomes = ["Muito fraca", "Fraca", "Razoável", "Razoável", "Boa", "Forte"];
    $("barra").style.width = ($("senha").value ? (n / 5) * 100 : 0) + "%";
    $("barra").style.background = cores[n];
    $("forca-texto").textContent = $("senha").value ? "Força da senha: " + nomes[n] : "Mínimo de 8 caracteres, com letras e números.";
  });

  $("form-cadastro").addEventListener("submit", async ev => {
    ev.preventDefault(); erro.hidden = true;
    const corpo = { nome: $("nome").value.trim(), email: $("email").value.trim(), perfil: $("perfil").value, senha: $("senha").value };
    if (corpo.nome.length < 2) return mostrarErro(erro, "Informe seu nome.");
    if (!/^\S+@\S+\.\S+$/.test(corpo.email)) return mostrarErro(erro, "Informe um e-mail válido.");
    if (!corpo.perfil) return mostrarErro(erro, "Escolha o seu perfil.");
    if (corpo.senha.length < 8 || !/[A-Za-z]/.test(corpo.senha) || !/\d/.test(corpo.senha))
      return mostrarErro(erro, "A senha precisa ter 8 ou mais caracteres, com letras e números.");
    if (corpo.senha !== $("senha2").value) return mostrarErro(erro, "As senhas não são iguais.");
    btn.disabled = true; btn.textContent = "Criando conta…";
    try {
      await chamarBackend("backend/auth.php?acao=cadastro", { metodo: "POST", corpo });
      location.replace("index.html");
    } catch (e) { mostrarErro(erro, e.message); btn.disabled = false; btn.textContent = "Criar conta"; }
  });
})();
