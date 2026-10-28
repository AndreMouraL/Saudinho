// VLibras: tradutor de Português para Libras do Governo Federal (acessibilidade para pessoas surdas).
// Carrega o widget oficial e mostra o botão azul de Libras no canto da tela.
(function () {
  const caixa = document.createElement("div");
  caixa.setAttribute("vw", ""); caixa.className = "enabled";
  caixa.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
  document.body.appendChild(caixa);
  const s = document.createElement("script");
  s.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
  s.onload = () => { try { new window.VLibras.Widget("https://vlibras.gov.br/app"); } catch (e) { console.warn("VLibras indisponível", e); } };
  document.body.appendChild(s);
})();
