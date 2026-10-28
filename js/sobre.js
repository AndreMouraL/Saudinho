// Dados editáveis da página "Sobre": troque pelos da sua faculdade e da sua equipe.
const SOBRE = {
  faculdade: "Nossa faculdade",
  curso: "Desenvolvimento Web",
  equipe: [
    { nome: "Integrante 1", papel: "Back-end e API" },
    { nome: "Integrante 2", papel: "Interface e design" },
    { nome: "Integrante 3", papel: "Mapa e dados" },
    { nome: "Professor(a)", papel: "Orientação" },
  ],
};

(function () {
  const box = document.getElementById("lista-equipe");
  for (const p of SOBRE.equipe) {
    const c = document.createElement("div"); c.className = "pessoa";
    const av = document.createElement("span"); av.className = "avatar-p";
    av.textContent = p.nome.split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase();
    const n = document.createElement("strong"); n.textContent = p.nome;
    const r = document.createElement("small"); r.textContent = p.papel;
    c.append(av, n, r); box.appendChild(c);
  }
  const f = document.querySelector(".etiqueta");
  if (f && SOBRE.faculdade !== "Nossa faculdade") f.textContent = "🎓 " + SOBRE.faculdade + " · " + SOBRE.curso;
})();
