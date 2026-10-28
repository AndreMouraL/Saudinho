// Painel de administração de usuários.
let usuarios = [], eu = null;

async function iniciarAdmin() {
  eu = await exigirLogin(true);
  if (!eu) return;
  montarNavbar(eu, "admin");
  $("busca").addEventListener("input", desenharTabela);
  await carregar();
}

async function carregar() {
  try { usuarios = (await chamarBackend("backend/admin.php?acao=listar")).usuarios; $("erro").hidden = true; }
  catch (e) { return mostrarErro($("erro"), e.message); }
  desenharResumo(); desenharTabela();
}

function desenharResumo() {
  const r = $("resumo"); r.replaceChildren();
  const dados = [["Usuários", usuarios.length], ["Ativos", usuarios.filter(u => u.ativo).length],
                 ["Administradores", usuarios.filter(u => u.papel === "admin").length], ["Desativados", usuarios.filter(u => !u.ativo).length]];
  for (const [nome, n] of dados) { const d = el("div"); d.append(el("strong", String(n)), el("span", nome)); r.appendChild(d); }
}

async function agir(acao, corpo, msg) {
  try { await chamarBackend("backend/admin.php?acao=" + acao, { metodo: "POST", corpo }); toast(msg, "ok"); await carregar(); }
  catch (e) { toast(e.message, "erro"); await carregar(); }
}

function confirmarExclusao(u) {
  const d = $("confirma");
  $("confirma-texto").textContent = "A conta de " + u.nome + " (" + u.email + ") será removida. Isso não pode ser desfeito.";
  d.onclose = () => { if (d.returnValue === "ok") agir("excluir", { id: u.id }, "Usuário excluído."); d.returnValue = ""; };
  d.showModal();
}

async function gerarLinkSenha(u) {
  try {
    const r = await chamarBackend("backend/admin.php?acao=link_senha", { metodo: "POST", corpo: { id: u.id } });
    try { await navigator.clipboard.writeText(r.link); toast("Link copiado. Envie a " + u.nome + " (vale " + r.minutos + " min).", "ok"); }
    catch { window.prompt("Copie o link e envie a " + u.nome + " (vale " + r.minutos + " min):", r.link); }
  } catch (e) { toast(e.message, "erro"); }
}

function desenharTabela() {
  const termo = semAcentoAdmin($("busca").value);
  const corpo = $("corpo"); corpo.replaceChildren();
  const lista = usuarios.filter(u => semAcentoAdmin([u.nome, u.email, u.perfil].join(" ")).includes(termo));
  if (!lista.length) { const tr = el("tr"); const td = el("td", "Nenhum usuário encontrado.", "vazio"); td.colSpan = 6; tr.appendChild(td); corpo.appendChild(tr); return; }

  for (const u of lista) {
    const tr = el("tr");
    const quem = el("td"); const q = el("div", null, "quem-linha"); const t = el("span");
    t.append(el("strong", u.nome), el("small", u.email));
    q.append(el("span", iniciais(u.nome), "avatar"), t); quem.appendChild(q);

    const papel = el("td");
    const proprio = u.id === eu.id;
    if (proprio) papel.appendChild(el("span", "Administrador (você)", "badge admin"));
    else {
      const s = el("select"); s.setAttribute("aria-label", "Papel de " + u.nome);
      for (const [v, n] of [["usuario", "Usuário"], ["admin", "Administrador"]]) { const o = el("option", n); o.value = v; s.appendChild(o); }
      s.value = u.papel;
      s.addEventListener("change", () => agir("papel", { id: u.id, papel: s.value }, "Papel atualizado."));
      papel.appendChild(s);
    }

    const sit = el("td"); sit.appendChild(el("span", u.ativo ? "Ativo" : "Desativado", "badge " + (u.ativo ? "ativo" : "inativo")));
    const acoes = el("td");
    if (!proprio) {
      const b1 = el("button", u.ativo ? "Desativar" : "Ativar", "btn"); b1.type = "button";
      b1.addEventListener("click", () => agir("ativo", { id: u.id, ativo: !u.ativo }, u.ativo ? "Conta desativada." : "Conta ativada."));
      const b2 = el("button", "Excluir", "btn"); b2.type = "button";
      b2.addEventListener("click", () => confirmarExclusao(u));
      const b3 = el("button", "Link de senha", "btn"); b3.type = "button"; b3.title = "Gera um link para a pessoa criar uma nova senha";
      b3.addEventListener("click", () => gerarLinkSenha(u));
      acoes.append(b1, b3, b2);
    }
    tr.append(quem, el("td", u.perfil), papel, sit, el("td", formatarData(u.ultimoAcesso)), acoes);
    corpo.appendChild(tr);
  }
}
const semAcentoAdmin = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
iniciarAdmin();
