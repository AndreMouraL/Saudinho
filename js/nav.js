// Barra de navegação das páginas internas.
function montarNavbar(usuario, pagina) {
  const nav = $("navbar"); nav.replaceChildren();

  const marca = el("a", null, "marca-nav"); marca.href = "index.html";
  const img = document.createElement("img"); img.src = "img/logo-simbolo.png"; img.alt = "";
  marca.append(img, el("span", "Saudinho"));

  const links = el("nav", null, "links"); links.setAttribute("aria-label", "Principal");
  const itens = [["index.html", "Mapa da rede", "mapa"], ["base.html", "Base do Maranhão", "base"], ["sobre.html", "Sobre o Saudinho", "sobre"]];
  if (usuario.papel === "admin") itens.push(["admin.html", "Administração", "admin"]);
  for (const [href, texto, chave] of itens) {
    const a = el("a", texto); a.href = href;
    if (chave === pagina) a.setAttribute("aria-current", "page");
    links.appendChild(a);
  }

  const quem = el("div", null, "quem");
  quem.append(el("strong", usuario.nome.split(" ")[0]), el("small", usuario.papel === "admin" ? "Administrador" : usuario.perfil));
  const sair = el("button", "Sair", "btn-texto"); sair.type = "button";
  sair.prepend(icone("i-sair"));
  sair.addEventListener("click", async () => {
    try { await chamarBackend("backend/auth.php?acao=sair", { metodo: "POST" }); } catch { /* sai mesmo assim */ }
    location.replace("login.html");
  });
  const direita = el("div", null, "usuario-nav");
  direita.append(quem, el("span", iniciais(usuario.nome), "avatar"), sair);

  nav.append(marca, links, direita);
}
