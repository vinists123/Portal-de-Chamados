/* ==========================================================================
   PESQUISA DE SATISFAÇÃO (v6.7)
   - Chamado foi para "Concluído" -> o solicitante precisa dar uma nota de 0 a 10
   - Pop-up automático, selo ⭐ no menu, aviso em Minhas demandas e botão no card
   - A nota vira comentário no card, e-mail para o responsável e indicador nas Análises
   - O time (MIS, Facilities e gestão) não é cobrado e suas notas não contam
   ========================================================================== */
(function () {
  if (typeof sessao !== "function" || typeof carregarDB !== "function") return;
  /* >>> AJUSTES <<< */
  /* ZERAR NOTAS: na 1ª vez que alguém do time (MIS, Facilities ou gestão) abrir o portal com esta versão,
     todas as notas dadas até aquele momento são apagadas e a pesquisa passa a valer só dali para frente.
     Para zerar de novo no futuro, basta trocar este texto (ex.: "reset-2027-01"). */
  const RESET_VERSAO = "reset-2026-10-20";
  const AVALIACAO_DESDE = "9999-12-31";   /* até o reset rodar ninguém é cobrado; depois vale a data/hora do reset */
  const ADIAR_HORAS = 4;                  /* "Avaliar depois" esconde o pop-up automático por X horas */

  const U = (typeof USER !== "undefined" && USER) ? USER : (() => { try { return sessao(); } catch (e) { return null; } })();
  if (!U) return;
  const EU = (U.matricula || "").toLowerCase();
  const CHAVE_ADIAR = "portal_pesquisa_adiada_" + EU;
  /* time (MIS, Facilities e gestão): não é cobrado e suas notas não entram nos indicadores */
  const TIME = (typeof ADMIN_MATRICULAS !== "undefined" ? ADMIN_MATRICULAS : []).map(x => String(x).toLowerCase());
  const doTime = l => TIME.includes((l || "").toLowerCase());
  let DESDE = AVALIACAO_DESDE;
  const sync = db => { if (db && db.pesquisa_desde) DESDE = db.pesquisa_desde; return db; };

  /* ---------------- regras ---------------- */
  const elegivel = d => d.status === "Concluído" && (d.dt_conclusao || "") >= DESDE && !doTime(d.solicitante_matricula);
  const pendentesDe = db => { sync(db); if (doTime(EU)) return [];
    return (db.demandas || []).filter(d => elegivel(d) && !d.avaliacao && (d.solicitante_matricula || "").toLowerCase() === EU)
      .sort((a, b) => (b.dt_conclusao || "").localeCompare(a.dt_conclusao || "")); };
  const corNota = n => n <= 6 ? "#D92D20" : n <= 8 ? "#E0A100" : "#12B76A";
  const corEscala = n => `hsl(${Math.round(n * 13)}, 78%, ${n >= 5 && n <= 7 ? 44 : 47}%)`;
  const FACES = [[0, "😡", "Muito insatisfeito"], [3, "😞", "Insatisfeito"], [5, "😕", "Pouco satisfeito"],
    [7, "🙂", "Satisfeito"], [9, "🤩", "Muito satisfeito"]];
  const face = n => FACES.reduce((r, f) => n >= f[0] ? f : r, FACES[0]);
  const perguntaComentario = n => n <= 6 ? "O que não funcionou bem? Seu comentário nos ajuda a melhorar." :
    n <= 8 ? "O que faltou para ser nota 10?" : "Que ótimo! Quer deixar um elogio para o time?";
  const adiado = () => { try { return Date.now() < +(localStorage.getItem(CHAVE_ADIAR) || 0); } catch (e) { return false; } };
  const adiar = () => { try { localStorage.setItem(CHAVE_ADIAR, Date.now() + ADIAR_HORAS * 36e5); } catch (e) {} };
  const nomeCurto = n => (n || "").split(" ").slice(0, 2).join(" ");

  function salvarAvaliacao(id, nota, comentario) {
    const db = carregarDB(), d = db.demandas.find(x => x.id === id);
    if (!d) throw new Error("Chamado não encontrado.");
    if (d.avaliacao) throw new Error("Este chamado já foi avaliado.");
    const dt = agoraStr();
    d.avaliacao = {nota, comentario: comentario || "", dt, por: U.matricula};
    db.comentarios.push({demanda_id: id, autor_matricula: U.matricula, autor_nome: U.nome, perfil: "Solicitante",
      texto: `⭐ Avaliação de satisfação: ${nota}/10${comentario ? "\n" + comentario : ""}`, dt_comentario: dt});
    const p = db.perfis[(d.responsavel_login || "").toLowerCase()];
    if (p && p.email && typeof registrarEmail === "function" && typeof htmlEmail === "function")
      registrarEmail(db, d, `[${d.protocolo}] Avaliação do solicitante: ${nota}/10`,
        htmlEmail(d, `Avaliação recebida: ${nota}/10 ${face(nota)[1]}`, `${esc(U.nome)} avaliou o atendimento deste chamado.`,
          comentario ? esc(comentario).replace(/\n/g, "<br>") : ""), p.email);
    gravarDB(db);
  }

  /* ---------------- estilo ---------------- */
  document.head.insertAdjacentHTML("beforeend", `<style>
    .sv-fundo{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;
      background:rgba(15,13,46,.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);animation:svF .25s ease}
    .sv{position:relative;width:620px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;background:var(--sup);color:var(--texto);
      border-radius:28px;box-shadow:0 30px 90px rgba(15,13,46,.5);animation:svE .4s cubic-bezier(.2,.9,.3,1.25)}
    .sv-topo{position:relative;overflow:hidden;padding:30px 30px 24px;color:#fff;text-align:center;
      background:radial-gradient(120% 140% at 50% 0%,#5B4DFF 0%,#3B2FD9 45%,#17145E 100%)}
    .sv-topo::before,.sv-topo::after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
    .sv-topo::before{width:260px;height:260px;left:-90px;top:-120px}.sv-topo::after{width:180px;height:180px;right:-60px;bottom:-90px}
    .sv-trofeu{position:relative;z-index:1;width:74px;height:74px;margin:0 auto 10px;border-radius:24px;display:grid;place-items:center;font-size:38px;
      background:linear-gradient(145deg,#FFD66B,#F0A400);box-shadow:0 10px 30px rgba(240,164,0,.45),inset 0 -4px 0 rgba(0,0,0,.12);animation:svPulo 2.6s ease-in-out infinite}
    .sv-tag{position:relative;z-index:1;display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
      background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:3px 11px;margin-bottom:8px}
    .sv-topo h2{position:relative;z-index:1;margin:0 0 6px;font-size:23px}
    .sv-cham{position:relative;z-index:1;font-size:13.5px;opacity:.92;overflow-wrap:anywhere}
    .sv-resp{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px;margin-top:12px;font-size:12.5px;
      background:rgba(255,255,255,.12);border-radius:22px;padding:4px 12px 4px 4px}
    .sv-resp i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:11px;background:#fff;color:#3B2FD9}
    .sv-x{position:absolute;top:14px;right:14px;z-index:3;width:36px;height:36px;border:0;border-radius:50%;cursor:pointer;
      background:rgba(255,255,255,.16);color:#fff;font-size:20px;transition:.15s}
    .sv-x:hover{background:rgba(255,255,255,.3);transform:rotate(90deg)}
    .sv-corpo{padding:24px 28px 8px;text-align:center}
    .sv-corpo h3{margin:0 0 14px;font-size:17px}
    .sv-face{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:14px;min-height:78px}
    .sv-face .emo{font-size:46px;line-height:1;transition:transform .25s cubic-bezier(.2,.9,.3,1.6)}
    .sv-face .emo.troca{transform:scale(1.25) rotate(-8deg)}
    .sv-face .lbl{font-size:13px;font-weight:700;color:var(--texto-2);transition:color .2s}
    .sv-escala{display:grid;grid-template-columns:repeat(11,1fr);gap:6px}
    .sv-n{aspect-ratio:1;min-width:0;border-radius:12px;border:2px solid color-mix(in srgb,var(--c) 45%,transparent);cursor:pointer;
      background:color-mix(in srgb,var(--c) 10%,var(--sup));color:var(--c);font-weight:800;font-size:15px;transition:transform .12s,box-shadow .12s,background .12s}
    .sv-n:hover{transform:translateY(-4px);box-shadow:0 8px 16px color-mix(in srgb,var(--c) 35%,transparent)}
    .sv-n.on{background:var(--c);color:#fff;transform:translateY(-4px) scale(1.12);box-shadow:0 10px 22px color-mix(in srgb,var(--c) 45%,transparent)}
    .sv-n.ate{background:color-mix(in srgb,var(--c) 22%,var(--sup))}
    .sv-leg{display:flex;justify-content:space-between;font-size:11.5px;color:var(--texto-2);margin-top:8px}
    .sv-com{margin-top:18px;text-align:left;animation:svF .3s ease}
    .sv-com.hidden{display:none}
    .sv-com label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}
    .sv-com textarea{width:100%;box-sizing:border-box;min-height:74px;border:1.5px solid var(--borda);border-radius:14px;padding:10px 12px;
      background:var(--input);color:var(--texto);font:inherit;resize:vertical}
    .sv-com textarea:focus{outline:none;border-color:var(--primaria)}
    .sv-com small{color:var(--texto-2);font-size:11.5px}
    .sv-rod{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 28px 22px}
    .sv-depois{border:0;background:none;color:var(--texto-2);font-weight:600;cursor:pointer;font-size:13px;text-decoration:underline}
    .sv-enviar{border:0;border-radius:14px;padding:12px 22px;font-weight:800;font-size:14.5px;cursor:pointer;color:#fff;
      background:linear-gradient(135deg,#5B4DFF,#3B2FD9);box-shadow:0 10px 24px rgba(59,47,217,.35);transition:.15s}
    .sv-enviar:hover:not(:disabled){transform:translateY(-2px)}
    .sv-enviar:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
    .sv-dots{display:flex;justify-content:center;gap:6px;padding:0 0 18px}
    .sv-dots i{width:8px;height:8px;border-radius:50%;background:var(--borda)}.sv-dots i.on{background:var(--primaria);width:22px;border-radius:5px}
    .sv-ok{padding:34px 30px 26px;text-align:center}
    .sv-ok .big{font-size:64px;animation:svE .5s cubic-bezier(.2,.9,.3,1.5)}
    .sv-ok h3{margin:8px 0 6px;font-size:21px}.sv-ok p{color:var(--texto-2);margin:0 0 20px}
    .sv-ok .nota{display:inline-block;font-size:30px;font-weight:900;color:#fff;border-radius:18px;padding:6px 18px;margin-bottom:10px}
    .sv-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:28px}
    .sv-conf i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:svCai 1.8s ease-in forwards}
    @keyframes svF{from{opacity:0}}
    @keyframes svE{from{opacity:0;transform:translateY(26px) scale(.92)}}
    @keyframes svPulo{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(-6deg)}}
    @keyframes svCai{to{transform:translateY(560px) rotate(720deg);opacity:0}}
    @media(max-width:560px){.sv-escala{grid-template-columns:repeat(6,1fr)}.sv-corpo{padding:20px 16px 6px}.sv-rod{padding:14px 16px 20px}}
    .sv-bad{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:800;
      color:#5A3B00;background:linear-gradient(135deg,#FFD66B,#F0A400);box-shadow:0 0 0 0 rgba(240,164,0,.6);animation:svBrilho 2s infinite;vertical-align:middle}
    @keyframes svBrilho{0%{box-shadow:0 0 0 0 rgba(240,164,0,.55)}70%{box-shadow:0 0 0 8px rgba(240,164,0,0)}100%{box-shadow:0 0 0 0 rgba(240,164,0,0)}}
    .sv-alerta{display:flex;align-items:center;gap:12px;flex-basis:100%;margin-top:4px;padding:12px 16px;border-radius:16px;cursor:pointer;
      background:linear-gradient(135deg,#FFF6DD,#FFE9B0);border:1px solid #F5C451;color:#5A3B00;font-size:13.5px}
    .sv-alerta .st{font-size:24px;animation:svPulo 2.6s ease-in-out infinite}
    .sv-alerta button{margin-left:auto;border:0;border-radius:12px;padding:8px 14px;font-weight:800;cursor:pointer;color:#fff;background:#E09A00}
    .tk.sv-pend{box-shadow:0 0 0 2px #F0B429,0 8px 20px rgba(240,180,41,.25)!important}
    .sv-card-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:10px;border:0;border-radius:12px;padding:8px;
      font-weight:800;font-size:12.5px;cursor:pointer;color:#5A3B00;background:linear-gradient(135deg,#FFD66B,#F0A400)}
    .sv-card-btn:hover{filter:brightness(1.05)}
    .sv-chip{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:800;color:#fff}
    .sv-chip.esp{background:var(--sup-2,#F3F1FF);color:var(--texto-2);font-weight:600}
    .sv-sec{margin:4px 0 14px;padding:14px 16px;border-radius:16px;border:1px solid var(--borda);
      background:linear-gradient(135deg,color-mix(in srgb,#F0B429 10%,var(--sup)),var(--sup))}
    .sv-sec h4{margin:0 0 6px}
    .sv-sec .lin{display:flex;align-items:center;gap:12px}
    .sv-sec .nt{font-size:26px;font-weight:900;color:#fff;border-radius:14px;padding:4px 12px}
  </style>`);

  /* ---------------- POP-UP DA PESQUISA ---------------- */
  let ABERTO = false;
  function abrirPesquisa(lista, idx = 0) {
    if (!lista.length || ABERTO) return;
    if (document.querySelector(".pop-fundo, .av-modal")) { setTimeout(() => abrirPesquisa(lista, idx), 1500); return; }
    ABERTO = true;
    const d = lista[idx];
    let nota = null;
    const fundo = document.createElement("div");
    fundo.className = "sv-fundo";
    const resp = d.responsavel || "Time " + (DESTINOS[destinoDe(d)] || {}).rotulo;
    fundo.innerHTML = `<div class="sv" role="dialog" aria-modal="true" aria-labelledby="svTit">
      <button class="sv-x" title="Fechar" aria-label="Fechar">×</button>
      <div class="sv-topo"><div class="sv-trofeu">🏆</div>
        <div class="sv-tag">Pesquisa de satisfação${lista.length > 1 ? ` · ${idx + 1} de ${lista.length}` : ""}</div>
        <h2 id="svTit">Seu chamado foi concluído!</h2>
        <div class="sv-cham"><b>${esc(d.protocolo)}</b> · ${esc(d.resumo)}</div>
        <div class="sv-resp"><i>${esc(iniciais(resp))}</i>Atendido por ${esc(nomeCurto(resp))} · concluído em ${fmt(d.dt_conclusao)}</div></div>
      <div class="sv-corpo"><h3>Avalie o nível de satisfação desse chamado</h3>
        <div class="sv-face"><span class="emo">🤔</span><span class="lbl">Escolha uma nota de 0 a 10</span></div>
        <div class="sv-escala">${Array.from({length: 11}, (_, n) => `<button class="sv-n" data-n="${n}" style="--c:${corEscala(n)}" aria-label="Nota ${n}">${n}</button>`).join("")}</div>
        <div class="sv-leg"><span>0 · Nada satisfeito</span><span>10 · Extremamente satisfeito</span></div>
        <div class="sv-com hidden"><label id="svComLbl"></label><textarea id="svCom" maxlength="500" placeholder="Opcional"></textarea>
          <small>Opcional · o time recebe sua avaliação.</small></div></div>
      <div class="sv-rod"><button class="sv-depois">Avaliar depois</button><button class="sv-enviar" disabled>Enviar avaliação</button></div>
      ${lista.length > 1 ? `<div class="sv-dots">${lista.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>`;
    document.body.appendChild(fundo);
    const box = fundo.querySelector(".sv"), emo = fundo.querySelector(".emo"), lbl = fundo.querySelector(".lbl");
    const fechar = marcarAdiado => {
      if (marcarAdiado) adiar();
      document.removeEventListener("keydown", tecla);
      fundo.style.opacity = "0"; fundo.style.transition = "opacity .2s";
      setTimeout(() => { fundo.remove(); ABERTO = false; atualizarSelos(); }, 200);
    };
    const tecla = e => {
      if (e.key === "Escape") fechar(true);
      if (/^[0-9]$/.test(e.key) && document.activeElement.id !== "svCom") escolher(+e.key);
    };
    document.addEventListener("keydown", tecla);
    fundo.querySelector(".sv-x").onclick = () => fechar(true);
    fundo.querySelector(".sv-depois").onclick = () => { fechar(true); toast(`Tudo bem! Lembraremos você em ${ADIAR_HORAS} horas.`); };
    fundo.addEventListener("click", e => { if (e.target === fundo) fechar(true); });

    function escolher(n) {
      nota = n;
      fundo.querySelectorAll(".sv-n").forEach(b => { const v = +b.dataset.n; b.classList.toggle("on", v === n); b.classList.toggle("ate", v < n); });
      const f = face(n);
      emo.textContent = f[1]; lbl.textContent = f[2]; lbl.style.color = corNota(n);
      emo.classList.remove("troca"); void emo.offsetWidth; emo.classList.add("troca");
      fundo.querySelector(".sv-com").classList.remove("hidden");
      fundo.querySelector("#svComLbl").textContent = perguntaComentario(n);
      fundo.querySelector(".sv-enviar").disabled = false;
    }
    fundo.querySelectorAll(".sv-n").forEach(b => b.onclick = () => escolher(+b.dataset.n));

    fundo.querySelector(".sv-enviar").onclick = () => {
      if (nota === null) return;
      try { salvarAvaliacao(d.id, nota, fundo.querySelector("#svCom").value.trim()); }
      catch (e) { toast(e.message); return; }
      const proxima = lista.filter(x => x.id !== d.id);
      box.innerHTML = `<div class="sv-conf"></div><div class="sv-ok">
        <div class="big">${nota >= 9 ? "🎉" : nota >= 7 ? "🙌" : "🤝"}</div>
        <div class="nota" style="background:${corNota(nota)}">${nota}/10</div>
        <h3>${nota >= 9 ? "Obrigado pela ótima avaliação!" : nota >= 7 ? "Obrigado pela avaliação!" : "Obrigado pela sinceridade!"}</h3>
        <p>${nota >= 7 ? "Sua nota foi enviada para o time." : "Vamos usar seu retorno para melhorar o atendimento."}</p>
        <button class="sv-enviar" id="svProx">${proxima.length ? `Avaliar o próximo (${proxima.length} restante${proxima.length > 1 ? "s" : ""}) →` : "Fechar"}</button></div>`;
      if (nota >= 9) confete(box.querySelector(".sv-conf"));
      box.querySelector("#svProx").onclick = () => {
        fundo.remove(); ABERTO = false; document.removeEventListener("keydown", tecla);
        if (typeof carregar === "function") { try { carregar(); } catch (e) {} }
        atualizarSelos();
        if (proxima.length) abrirPesquisa(proxima, 0);
      };
      if (typeof carregar === "function") { try { carregar(); } catch (e) {} }
      atualizarSelos();
    };
  }
  function confete(el) {
    const cores = ["#5B4DFF", "#F0B429", "#12B76A", "#E86FA8", "#2EC4B6", "#FF9F6B"];
    el.innerHTML = Array.from({length: 70}, (_, i) =>
      `<i style="left:${Math.random() * 100}%;background:${cores[i % cores.length]};animation-delay:${Math.random() * .5}s;animation-duration:${1.4 + Math.random()}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join("");
  }

  /* ---------------- selo ⭐ no menu ---------------- */
  let CONHECIDOS = null;
  function atualizarSelos() {
    let lista = [];
    try { lista = pendentesDe(carregarDB()); } catch (e) { return []; }
    const link = document.querySelector('#menu a[href="minhas.html"]');
    if (link) {
      let b = link.querySelector(".sv-bad");
      if (lista.length) { if (!b) { b = document.createElement("span"); b.className = "sv-bad"; link.appendChild(b); }
        b.textContent = "⭐ " + lista.length; b.title = `${lista.length} chamado(s) aguardando sua avaliação`; }
      else if (b) b.remove();
    }
    return lista;
  }

  /* ---------------- Minhas demandas / Quadro: aviso e cards ---------------- */
  function decorarQuadro() {
    if (typeof DEMANDAS === "undefined") return;
    const minhas = typeof MODO !== "undefined" && MODO !== "todas";
    if (minhas && !doTime(EU)) {
      const pend = DEMANDAS.filter(d => elegivel(d) && !d.avaliacao);
      const k = document.getElementById("kpis");
      if (k && pend.length && !k.querySelector(".sv-alerta")) {
        k.insertAdjacentHTML("beforeend", `<div class="sv-alerta" id="svAlerta"><span class="st">⭐</span>
          <span>Você tem <b>${pend.length}</b> chamado${pend.length > 1 ? "s" : ""} concluído${pend.length > 1 ? "s" : ""} aguardando sua avaliação. Leva menos de 10 segundos!</span>
          <button>Avaliar agora</button></div>`);
        k.querySelector("#svAlerta").onclick = () => abrirPesquisa(pendentesDe(carregarDB()));
      }
    }
    document.querySelectorAll(".tk[data-id]").forEach(el => {
      const d = DEMANDAS.find(x => x.id === +el.dataset.id);
      if (!d || !elegivel(d) || el.querySelector(".sv-card-btn, .sv-chip")) return;
      const corpo = el.querySelector(".tk-corpo") || el;
      if (d.avaliacao) {
        corpo.insertAdjacentHTML("beforeend", `<span class="sv-chip" style="background:${corNota(d.avaliacao.nota)}" title="${esc(d.avaliacao.comentario || "Sem comentário")}">⭐ ${d.avaliacao.nota}/10</span>`);
      } else if (minhas && (d.solicitante_matricula || "").toLowerCase() === EU) {
        el.classList.add("sv-pend");
        corpo.insertAdjacentHTML("beforeend", `<button class="sv-card-btn">⭐ Avaliar este chamado</button>`);
        el.querySelector(".sv-card-btn").onclick = e => { e.stopPropagation(); abrirPesquisa([d]); };
      } else corpo.insertAdjacentHTML("beforeend", `<span class="sv-chip esp">⏳ Aguardando avaliação</span>`);
    });
  }
  function decorarCard(id) {
    const dw = document.querySelector("#modal .drawer"); if (!dw || dw.querySelector(".sv-sec")) return;
    const d = (typeof DEMANDAS !== "undefined" ? DEMANDAS : []).find(x => x.id === id);
    if (!d || !elegivel(d)) return;
    const meu = (d.solicitante_matricula || "").toLowerCase() === EU;
    const html = d.avaliacao
      ? `<div class="sv-sec"><h4>⭐ Avaliação do solicitante</h4><div class="lin"><span class="nt" style="background:${corNota(d.avaliacao.nota)}">${d.avaliacao.nota}/10</span>
          <div><b>${face(d.avaliacao.nota)[1]} ${face(d.avaliacao.nota)[2]}</b><br><small style="color:var(--texto-2)">em ${fmt(d.avaliacao.dt)}</small>
          ${d.avaliacao.comentario ? `<div style="margin-top:4px">${esc(d.avaliacao.comentario)}</div>` : ""}</div></div></div>`
      : meu ? `<div class="sv-sec"><h4>⭐ Como foi o atendimento?</h4><div class="lin"><span>Avalie de 0 a 10 a sua satisfação com este chamado.</span>
          <button class="sv-card-btn" style="width:auto;margin:0 0 0 auto;padding:9px 16px" id="svDw">Avaliar agora</button></div></div>`
      : `<div class="sv-sec"><h4>⏳ Aguardando avaliação do solicitante</h4><small style="color:var(--texto-2)">A pesquisa de satisfação foi liberada quando o chamado foi concluído.</small></div>`;
    const topo = dw.querySelector(".dw-top");
    (topo || dw.firstElementChild).insertAdjacentHTML("afterend", html);
    const b = dw.querySelector("#svDw"); if (b) b.onclick = () => abrirPesquisa([d]);
  }

  /* ---------------- ANÁLISES: indicador de satisfação ---------------- */
  function painelSatisfacao() {
    const alvo = document.getElementById("kpisAn"); if (!alvo) return;
    let sec = document.getElementById("svPainel");
    if (!sec) {
      document.head.insertAdjacentHTML("beforeend", `<style>
        #svPainel{margin:18px 0 0}
        .svp{background:var(--sup);border:1px solid var(--borda);border-radius:20px;padding:18px 20px;box-shadow:var(--sombra)}
        .svp h3{margin:0}.svp .sub{color:var(--texto-2);font-size:12.5px;margin:2px 0 14px}
        .svp-grid{display:grid;grid-template-columns:230px minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start}
        .svp-gauge{text-align:center}.svp-gauge svg{width:100%;max-width:220px}
        .svp-gauge .v{font-size:34px;font-weight:900;margin-top:-58px}.svp-gauge .l{font-size:12px;color:var(--texto-2)}
        .svp-kp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}
        .svp-kp div{background:var(--sup-2,#F3F1FF);border-radius:12px;padding:8px 10px;text-align:left}
        .svp-kp b{display:block;font-size:19px}.svp-kp small{font-size:11px;color:var(--texto-2)}
        .svp-barras{display:grid;grid-template-columns:repeat(11,1fr);gap:5px;align-items:end;height:150px;margin-top:4px}
        .svp-barras div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:3px;font-size:10.5px;color:var(--texto-2)}
        .svp-barras i{width:100%;border-radius:6px 6px 3px 3px;min-height:3px;animation:svCresce .7s ease both}
        @keyframes svCresce{from{transform:scaleY(0);transform-origin:bottom}}
        .svp-faixa{display:flex;height:12px;border-radius:7px;overflow:hidden;margin:12px 0 6px}
        .svp-faixa span{display:block;height:100%}
        .svp-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--texto-2)}
        .svp-leg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}
        .svp-tab{width:100%;border-collapse:collapse;font-size:12.5px}
        .svp-tab th{text-align:left;color:var(--texto-2);font-size:11px;padding:4px 6px;border-bottom:1px solid var(--borda)}
        .svp-tab td{padding:6px;border-bottom:1px solid var(--borda)}
        .svp-ch{display:inline-block;min-width:34px;text-align:center;color:#fff;font-weight:800;border-radius:8px;padding:1px 6px}
        .svp-coms{margin-top:14px;display:flex;flex-direction:column;gap:8px}
        .svp-coms div{border-left:4px solid var(--c);background:color-mix(in srgb,var(--c) 7%,var(--sup));border-radius:10px;padding:8px 12px;font-size:12.5px}
        .svp-coms small{color:var(--texto-2)}
        .svp-vazio{color:var(--texto-2);font-size:13px;padding:18px;text-align:center}
        @media(max-width:1100px){.svp-grid{grid-template-columns:1fr}}
      </style>`);
      sec = document.createElement("section"); sec.id = "svPainel";
      alvo.insertAdjacentElement("afterend", sec);
    }
    let db; try { db = sync(carregarDB()); } catch (e) { return; }
    const Fx = typeof F !== "undefined" ? F : {};
    const ini = !Fx.periodo || Fx.periodo === "tudo" ? null : dataStr(new Date(Date.now() - (+Fx.periodo) * 864e5));
    const base = (db.demandas || []).filter(d => (typeof podeVerNaAnalise !== "function" || podeVerNaAnalise(U, d))
      && (!Fx.destino || destinoDe(d) === Fx.destino) && (!Fx.operadora || d.operadora === Fx.operadora)
      && (!Fx.responsavel || (d.responsavel || "Sem responsável") === Fx.responsavel)
      && elegivel(d) && (!ini || (d.dt_conclusao || "") >= ini));
    const av = base.filter(d => d.avaliacao), n = av.length;
    const notas = av.map(d => d.avaliacao.nota);
    const media = n ? notas.reduce((s, x) => s + x, 0) / n : NaN;
    const prom = notas.filter(x => x >= 9).length, neut = notas.filter(x => x >= 7 && x <= 8).length, det = notas.filter(x => x <= 6).length;
    const nps = n ? Math.round((prom - det) / n * 100) : NaN;
    const taxa = base.length ? Math.round(n / base.length * 100) : NaN;
    const n1 = v => isFinite(v) ? v.toLocaleString("pt-BR", {maximumFractionDigits: 1}) : "—";
    const desde = DESDE && DESDE < "9999" ? ` · válidas desde ${fmt(DESDE)}` : "";

    if (!base.length) {
      sec.innerHTML = `<div class="svp"><h3>⭐ Satisfação dos solicitantes</h3><div class="svp-vazio">Ainda não há chamados concluídos no período para avaliar${desde}.</div></div>`;
      return;
    }
    const ang = Math.PI * (1 - (isFinite(media) ? media : 0) / 10), x = 110 + 85 * Math.cos(ang), y = 110 - 85 * Math.sin(ang);
    const gauge = `<svg viewBox="0 0 220 125"><defs><linearGradient id="svGr" x1="0" x2="1"><stop offset="0" stop-color="#D92D20"/><stop offset=".55" stop-color="#E0A100"/><stop offset="1" stop-color="#12B76A"/></linearGradient></defs>
      <path d="M25 110 A85 85 0 0 1 195 110" fill="none" stroke="var(--sup-2,#ECEAF8)" stroke-width="18" stroke-linecap="round"/>
      ${n ? `<path d="M25 110 A85 85 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="url(#svGr)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#fff" stroke="${corNota(media)}" stroke-width="5"/>` : ""}</svg>`;
    const dist = Array.from({length: 11}, (_, i) => notas.filter(v => v === i).length), mx = Math.max(1, ...dist);
    const porResp = {};
    av.forEach(d => { const k = d.responsavel || "Sem responsável"; (porResp[k] = porResp[k] || []).push(d.avaliacao.nota); });
    const linhas = Object.entries(porResp).map(([r, l]) => [r, l.length, l.reduce((s, v) => s + v, 0) / l.length,
      Math.round((l.filter(v => v >= 9).length - l.filter(v => v <= 6).length) / l.length * 100)]).sort((a, b) => b[1] - a[1]);
    const coms = av.filter(d => d.avaliacao.comentario).sort((a, b) => (b.avaliacao.dt || "").localeCompare(a.avaliacao.dt || "")).slice(0, 5);

    sec.innerHTML = `<div class="svp"><h3>⭐ Satisfação dos solicitantes</h3>
      <div class="sub">Notas de 0 a 10 dadas pelos solicitantes ao concluir o chamado (sem as notas do time) · ${n} avaliação(ões) de ${base.length} chamado(s) concluído(s) no período${desde}</div>
      <div class="svp-grid">
        <div class="svp-gauge">${gauge}<div class="v" style="color:${isFinite(media) ? corNota(media) : "var(--texto-2)"}">${n1(media)}</div><div class="l">nota média</div>
          <div class="svp-kp">
            <div><b style="color:${!isFinite(nps) ? "inherit" : nps >= 50 ? "#12B76A" : nps >= 0 ? "#E0A100" : "#D92D20"}">${isFinite(nps) ? nps : "—"}</b><small>NPS do atendimento</small></div>
            <div><b>${isFinite(taxa) ? taxa + "%" : "—"}</b><small>taxa de resposta</small></div>
            <div><b>${n ? Math.round(prom / n * 100) + "%" : "—"}</b><small>notas 9 e 10</small></div>
            <div><b>${base.length - n}</b><small>aguardando nota</small></div></div></div>
        <div><b style="font-size:13px">Distribuição das notas</b>
          ${n ? `<div class="svp-barras">${dist.map((q, i) => `<div title="Nota ${i}: ${q}"><span>${q || ""}</span><i style="height:${q / mx * 100}%;background:${corEscala(i)};animation-delay:${i * 40}ms"></i><span>${i}</span></div>`).join("")}</div>
          <div class="svp-faixa">${[[det, "#D92D20"], [neut, "#E0A100"], [prom, "#12B76A"]].map(([q, c]) => q ? `<span style="width:${q / n * 100}%;background:${c}"></span>` : "").join("")}</div>
          <div class="svp-leg"><span><i style="background:#D92D20"></i>Detratores 0–6: ${det}</span><span><i style="background:#E0A100"></i>Neutros 7–8: ${neut}</span><span><i style="background:#12B76A"></i>Promotores 9–10: ${prom}</span></div>`
          : `<div class="svp-vazio">Nenhuma nota recebida ainda no período.</div>`}</div>
        <div><b style="font-size:13px">Por responsável</b>
          ${linhas.length ? `<table class="svp-tab"><thead><tr><th>Responsável</th><th>Notas</th><th>Média</th><th>NPS</th></tr></thead><tbody>
            ${linhas.map(([r, q, m, p]) => `<tr><td>${esc(r)}</td><td>${q}</td><td><span class="svp-ch" style="background:${corNota(m)}">${n1(m)}</span></td><td>${p}</td></tr>`).join("")}</tbody></table>`
            : `<div class="svp-vazio">—</div>`}
          ${coms.length ? `<div class="svp-coms">${coms.map(d => `<div style="--c:${corNota(d.avaliacao.nota)}"><b>${d.avaliacao.nota}/10</b> · ${esc(d.avaliacao.comentario)}<br>
            <small>${esc(d.protocolo)} · ${esc(d.responsavel || "—")} · ${fmt(d.avaliacao.dt)}</small></div>`).join("")}</div>` : ""}</div>
      </div></div>`;
  }

  /* ---------------- ZERAR NOTAS (roda uma única vez, pelo 1º do time que abrir o portal) ---------------- */
  (function zerarNotas() {
    let db; try { db = sync(carregarDB()); } catch (e) { return; }
    if (db.pesquisa_reset === RESET_VERSAO || !doTime(EU)) return;
    try {
      let n = 0;
      (db.demandas || []).forEach(d => { if (d.avaliacao) { delete d.avaliacao; n++; } });
      db.comentarios = (db.comentarios || []).filter(c => !String(c.texto || "").startsWith("⭐ Avaliação de satisfação"));
      db.pesquisa_reset = RESET_VERSAO;
      db.pesquisa_desde = agoraStr();
      gravarDB(db);
      sync(db);
      if (U.nivel === 3) toast(`Pesquisa de satisfação zerada: ${n} nota(s) removida(s). Vale a partir de agora.`);
    } catch (e) {}
  })();
  try { sync(carregarDB()); } catch (e) {}

  /* ---------------- liga nas telas ---------------- */
  if (typeof renderQuadro === "function") {
    const _render = renderQuadro;
    renderQuadro = function () { _render.apply(this, arguments); decorarQuadro(); };
    if (typeof abrir === "function") { const _abrir = abrir; abrir = function (id) { _abrir.apply(this, arguments); decorarCard(id); }; }
    if (typeof MODO !== "undefined" && MODO !== "todas" && typeof TELA !== "undefined") {
      try { if (pendentesDe(carregarDB()).length) TELA.recolhidos["Concluído"] = false; } catch (e) {}
    }
    try { renderQuadro(); } catch (e) {}
  }
  if (document.getElementById("painel") && typeof render === "function") {
    const _r = render;
    render = function () { _r.apply(this, arguments); painelSatisfacao(); };
    painelSatisfacao();
  }

  /* ---------------- pop-up automático + novas pendências em tempo real ---------------- */
  function verificar(auto) {
    const lista = atualizarSelos();
    const ids = lista.map(d => d.id).join(",");
    const novos = CONHECIDOS !== null && ids !== CONHECIDOS && lista.some(d => !CONHECIDOS.split(",").includes(String(d.id)));
    CONHECIDOS = ids;
    if (lista.length && !ABERTO && (novos || (auto && !adiado()))) abrirPesquisa(lista);
  }
  setTimeout(() => verificar(true), 900);
  let VER = null;
  setInterval(async () => {
    if (document.hidden || ABERTO || typeof MODO_REDE === "undefined" || !MODO_REDE) return;
    try {
      const r = await fetch("api/db/versao", {cache: "no-store"}); if (!r.ok) return;
      const v = (await r.json()).versao;
      if (VER !== null && v !== VER) verificar(false);
      VER = v;
    } catch (e) {}
  }, 20000);
  window.abrirPesquisaSatisfacao = () => abrirPesquisa(pendentesDe(carregarDB()));
})();
