// Comunicação com o back-end de autenticação (sessão por cookie + token anti-CSRF).
const Sessao = { csrf: "", usuario: null, admins: [] };

async function chamarBackend(url, { metodo = "GET", corpo } = {}) {
  const opcoes = { method: metodo, headers: { Accept: "application/json" }, credentials: "same-origin" };
  if (metodo !== "GET") {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.headers["X-CSRF-Token"] = Sessao.csrf;
    opcoes.body = JSON.stringify(corpo || {});
  }
  let resp;
  try { resp = await fetch(url, opcoes); } catch { throw new Error("Sem conexão com o servidor."); }
  const texto = await resp.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new Error("O PHP não respondeu. Inicie com: php -S localhost:8000"); }
  if (!resp.ok) { const e = new Error(dados.erro || "Erro " + resp.status); e.status = resp.status; throw e; }
  return dados;
}

async function carregarSessao() {
  const d = await chamarBackend("backend/auth.php?acao=eu");
  Sessao.csrf = d.csrf; Sessao.usuario = d.usuario; Sessao.admins = d.admins || [];
  mostrarAdminNoRodape();
  return d.usuario;
}

// Páginas protegidas: manda para o login se não houver sessão.
async function exigirLogin(somenteAdmin = false) {
  let u;
  try { u = await carregarSessao(); } catch (e) { document.body.textContent = e.message; return null; }
  if (!u) { location.replace("login.html"); return null; }
  if (somenteAdmin && u.papel !== "admin") { montarAcessoRestrito(u); return null; }
  return u;
}

// Rodapé: "Administrador: Nome" para todo usuário logado saber quem libera acessos.
function mostrarAdminNoRodape() {
  const alvo = document.querySelector(".rodape span"); if (!alvo || !Sessao.admins.length || alvo.querySelector(".rodape-adm")) return;
  const s = document.createElement("span"); s.className = "rodape-adm";
  s.textContent = " · Administrador" + (Sessao.admins.length > 1 ? "es: " : ": ") + Sessao.admins.join(", ");
  alvo.appendChild(s);
}

// Quem não é administrador vê uma explicação (em vez de ser mandado de volta sem aviso).
function montarAcessoRestrito(u) {
  const main = document.querySelector("main.conteudo"); if (!main) return;
  const nav = document.getElementById("navbar"); if (nav && typeof montarNavbar === "function") montarNavbar(u, "admin");
  main.replaceChildren();
  const caixa = document.createElement("section"); caixa.className = "restrito";
  const h = document.createElement("h1"); h.textContent = "Acesso restrito a administradores";
  const p1 = document.createElement("p"); p1.textContent = "Você entrou como " + u.nome + " (" + u.email + "), que tem perfil de usuário comum.";
  const p2 = document.createElement("p"); p2.textContent = Sessao.admins.length ? "Para liberar o acesso, fale com: " + Sessao.admins.join(", ") + "." : "Não há administrador ativo cadastrado.";
  const a = document.createElement("a"); a.href = "index.html"; a.className = "btn btn-primario"; a.textContent = "Voltar ao mapa";
  caixa.append(h, p1, p2, a); main.appendChild(caixa);
}
