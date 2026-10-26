/* ==========================================================================
   PESSOAS CADASTRADAS (somente gestão: Vinicius e Rogerio)
   - Botão "👥 Pessoas" no Quadro do time
   - Corrige nome e e-mail de quem já se cadastrou
   - "Padronizar nomes": RODRIGO NEVES DE OLIVEIRA -> Rodrigo Neves de Oliveira
   - O nome novo é aplicado também nos chamados, responsáveis e comentários
   ========================================================================== */
(function () {
  if (typeof USER === "undefined" || !USER) return;

  /* remove o botão "Limpar testes" para todos */
  document.querySelectorAll("#exportBtns a, #exportBtns button").forEach(b => { if (/Limpar/i.test(b.textContent)) b.remove(); });

  if (USER.nivel !== 3) return;

  const MINUSCULAS = ["da", "das", "de", "di", "do", "dos", "du", "e", "y", "van", "von", "der"];
  const padronizar = nome => (nome || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").split(" ")
    .map((p, i) => i > 0 && MINUSCULAS.includes(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)).join(" ");

  document.head.insertAdjacentHTML("beforeend", `<style>
    .ps-fundo{position:fixed;inset:0;z-index:70;background:rgba(15,13,46,.45);display:flex;align-items:center;justify-content:center;padding:16px}
    .ps-box{background:var(--sup);color:var(--texto);border-radius:20px;width:820px;max-width:100%;max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,13,46,.35)}
    .ps-cab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 22px 10px;border-bottom:1px solid var(--borda)}
    .ps-cab h3{margin:0;font-size:18px}.ps-cab p{margin:2px 0 0;font-size:12.5px;color:var(--texto-2)}
    .ps-ctrl{display:flex;gap:8px;padding:12px 22px;flex-wrap:wrap}
    .ps-ctrl input{flex:1;min-width:200px;border:1px solid var(--borda);border-radius:12px;padding:8px 12px;background:var(--input);color:var(--texto);font:inherit}
    .ps-lista{overflow:auto;padding:0 22px 8px}
    .ps-tab{width:100%;border-collapse:collapse;font-size:13px}
    .ps-tab th{position:sticky;top:0;background:var(--sup);text-align:left;font-size:11.5px;color:var(--texto-2);padding:8px 6px;border-bottom:1px solid var(--borda)}
    .ps-tab td{padding:6px;border-bottom:1px solid var(--borda);vertical-align:middle}
    .ps-tab input{width:100%;box-sizing:border-box;border:1px solid transparent;border-radius:8px;padding:6px 8px;background:transparent;color:var(--texto);font:inherit}
    .ps-tab input:hover{border-color:var(--borda)}
    .ps-tab input:focus{outline:none;border-color:var(--primaria);background:var(--input)}
    .ps-tab tr.mudou input{background:color-mix(in srgb,var(--ouro,#f0b429) 14%,transparent)}
    .ps-tab .lg{font-family:Consolas,monospace;font-size:12px;color:var(--texto-2);white-space:nowrap}
    .ps-tab .alerta{color:#B54708;font-size:11px;font-weight:600;white-space:nowrap}
    .ps-rod{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 22px;border-top:1px solid var(--borda)}
    .ps-rod small{color:var(--texto-2)}
    .ps-btn{border:1px solid var(--borda);background:var(--input);color:var(--texto);border-radius:14px;padding:8px 14px;font-weight:600;cursor:pointer;font-size:13px}
    .ps-btn:hover{border-color:var(--primaria);color:var(--primaria)}
    .ps-btn.pri{background:var(--primaria);border-color:var(--primaria);color:#fff}
    .ps-btn.pri:hover{color:#fff;filter:brightness(1.08)}
  </style>`);

  /* botão no lugar do antigo "Limpar testes" */
  const barra = document.getElementById("exportBtns");
  if (barra) barra.insertAdjacentHTML("beforeend", `<a class="pl-btn" href="#" id="btnPessoas">👥 Pessoas</a>`);
  const btn = document.getElementById("btnPessoas");
  if (btn) btn.onclick = e => { e.preventDefault(); abrirPessoas(); };

  function abrirPessoas() {
    let db; try { db = carregarDB(); } catch (e) { toast(e.message); return; }
    const linhas = Object.entries(db.perfis || {}).map(([login, p]) => ({login, nome: p.nome || "", email: p.email || ""}))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const fora = n => n && n !== padronizar(n);
    const qtdFora = linhas.filter(l => fora(l.nome)).length;

    const fundo = document.createElement("div");
    fundo.className = "ps-fundo";
    fundo.innerHTML = `<div class="ps-box">
      <div class="ps-cab"><div><h3>👥 Pessoas cadastradas</h3>
        <p>Corrija nome e e-mail. A alteração vale para os chamados, responsáveis e comentários dessa pessoa.</p></div>
        <button class="ps-btn" data-x title="Fechar">✕</button></div>
      <div class="ps-ctrl"><input id="psBusca" placeholder="🔎 Buscar por nome, login ou e-mail">
        <button class="ps-btn" id="psPadr" title="Deixa todos os nomes no padrão: Primeira Letra Maiúscula">Aa Padronizar nomes${qtdFora ? ` (${qtdFora})` : ""}</button></div>
      <div class="ps-lista"><table class="ps-tab"><thead><tr><th style="width:120px">Login</th><th>Nome</th><th>E-mail</th><th style="width:90px"></th></tr></thead>
        <tbody>${linhas.map(l => `<tr data-login="${esc(l.login)}">
          <td class="lg">${esc(l.login)}</td>
          <td><input class="psNome" value="${esc(l.nome)}" data-orig="${esc(l.nome)}"></td>
          <td><input class="psEmail" value="${esc(l.email)}" data-orig="${esc(l.email)}"></td>
          <td class="alerta">${fora(l.nome) ? "fora do padrão" : ""}</td></tr>`).join("")
          || `<tr><td colspan="4" style="color:var(--texto-2);padding:14px 6px">Ninguém cadastrado ainda.</td></tr>`}</tbody></table></div>
      <div class="ps-rod"><small id="psInfo">${linhas.length} pessoa(s) cadastrada(s)</small>
        <span><button class="ps-btn" data-x>Cancelar</button> <button class="ps-btn pri" id="psSalvar">Salvar alterações</button></span></div></div>`;
    document.body.appendChild(fundo);

    const fechar = () => { fundo.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = e => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    fundo.querySelectorAll("[data-x]").forEach(b => b.onclick = fechar);
    fundo.addEventListener("click", e => { if (e.target === fundo) fechar(); });

    const marcar = tr => {
      const n = tr.querySelector(".psNome"), m = tr.querySelector(".psEmail");
      tr.classList.toggle("mudou", n.value !== n.dataset.orig || m.value !== m.dataset.orig);
      tr.querySelector(".alerta").textContent = fora(n.value) ? "fora do padrão" : "";
      const q = fundo.querySelectorAll("tr.mudou").length;
      fundo.querySelector("#psInfo").textContent = q ? `${q} alteração(ões) não salva(s)` : `${linhas.length} pessoa(s) cadastrada(s)`;
    };
    fundo.querySelectorAll("tbody tr[data-login]").forEach(tr => tr.querySelectorAll("input").forEach(i => i.oninput = () => marcar(tr)));

    fundo.querySelector("#psBusca").oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      fundo.querySelectorAll("tbody tr[data-login]").forEach(tr => {
        const t = (tr.dataset.login + " " + tr.querySelector(".psNome").value + " " + tr.querySelector(".psEmail").value).toLowerCase();
        tr.style.display = !q || t.includes(q) ? "" : "none";
      });
    };
    fundo.querySelector("#psPadr").onclick = () => {
      fundo.querySelectorAll("tbody tr[data-login]").forEach(tr => {
        const n = tr.querySelector(".psNome"); n.value = padronizar(n.value); marcar(tr);
      });
      toast("Nomes padronizados. Confira e clique em Salvar alterações.");
    };
    fundo.querySelector("#psSalvar").onclick = () => {
      const mud = [...fundo.querySelectorAll("tbody tr.mudou")].map(tr => ({
        login: tr.dataset.login, nome: tr.querySelector(".psNome").value.trim().replace(/\s+/g, " "), email: tr.querySelector(".psEmail").value.trim()}));
      if (!mud.length) { fechar(); return; }
      for (const m of mud) {
        if (m.nome.length < 3) { toast(`Informe o nome de ${m.login}.`); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) { toast(`E-mail inválido para ${m.login}.`); return; }
      }
      try {
        const d = carregarDB();
        mud.forEach(m => {
          const l = m.login.toLowerCase();
          d.perfis[l] = {...(d.perfis[l] || {}), nome: m.nome, email: m.email};
          d.demandas.forEach(x => {
            if ((x.responsavel_login || "").toLowerCase() === l) x.responsavel = m.nome;
            if ((x.solicitante_matricula || "").toLowerCase() === l) { x.solicitante_nome = m.nome; x.solicitante_email = m.email; }
          });
          d.comentarios.forEach(c => { if ((c.autor_matricula || "").toLowerCase() === l) c.autor_nome = m.nome; });
          (d.avisos || []).forEach(a => { if ((a.atualizado_por || "").toLowerCase() === l) a.atualizado_por_nome = m.nome; });
        });
        gravarDB(d);
        fechar();
        toast(`${mud.length} cadastro(s) atualizado(s).`);
        if (typeof carregar === "function") carregar();
      } catch (e) { toast(e.message); }
    };
  }
})();
