(async () => {
  const erro = $("erro"), ok = $("ok"), btn = $("btn");
  try { if (await carregarSessao()) return location.replace("index.html"); }
  catch (e) { mostrarErro(erro, e.message); }
  $("form-rec").addEventListener("submit", async ev => {
    ev.preventDefault(); erro.hidden = ok.hidden = true;
    const email = $("email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return mostrarErro(erro, "Informe um e-mail válido.");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const r = await chamarBackend("backend/auth.php?acao=esqueci", { metodo: "POST", corpo: { email } });
      ok.replaceChildren("Se este e-mail estiver cadastrado, o link de recuperação foi gerado e vale por 30 minutos. Confira também a caixa de spam.");
      if (r.link_local) {   // só aparece rodando em localhost, sem servidor de e-mail
        const p = el("p"); p.append("Modo local (sem e-mail configurado): ");
        const a = el("a", "abrir o link de redefinição"); a.href = r.link_local; p.appendChild(a); ok.appendChild(p);
      }
      ok.hidden = false;
    } catch (e) { mostrarErro(erro, e.message); }
    btn.disabled = false; btn.textContent = "Enviar link de recuperação";
  });
})();
