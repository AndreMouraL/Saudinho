// Utilitários de interface usados por todas as páginas.
const $ = id => document.getElementById(id);

// Cria um elemento sem innerHTML: todo texto entra via textContent.
function el(tag, texto, classe) {
  const e = document.createElement(tag);
  if (texto != null) e.textContent = texto;
  if (classe) e.className = classe;
  return e;
}

// Ícone do arquivo img/simbolos.svg
function icone(id, classe) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "img/simbolos.svg#" + id);
  s.setAttribute("class", classe || "mini"); s.setAttribute("aria-hidden", "true");
  s.appendChild(u); return s;
}

// Aviso rápido no canto da tela.
function toast(msg, tipo = "") {
  let area = $("toasts");
  if (!area) { area = el("div"); area.id = "toasts"; area.setAttribute("role", "status"); document.body.appendChild(area); }
  const t = el("div", msg, "toast " + tipo);
  area.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function mostrarErro(caixa, msg) { caixa.textContent = msg; caixa.hidden = false; }

// Botões "Mostrar/Ocultar" dos campos de senha.
function ativarOlho() {
  document.querySelectorAll("[data-olho]").forEach(b => b.addEventListener("click", () => {
    const campo = $(b.dataset.olho);
    const mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    b.textContent = mostrar ? "Ocultar" : "Mostrar";
  }));
}

const iniciais = nome => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
const formatarData = iso => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
