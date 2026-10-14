/* ==========================================================================
   AVISOS E FAQ  (botão compacto no canto superior direito da Nova solicitação)
   - Usuários: os avisos abrem em POP-UP ao entrar (botão fechar); o FAQ fica no botão do canto
   - Gestão (vi37114368 e ro37110232): vê o painel completo e cria/edita/exclui
   - O servidor também bloqueia alterações de quem não é gestor
   - Atualiza sozinho quando a gestão publica algo (sem F5)
   ========================================================================== */
(function () {
  const pagina = document.querySelector(".pagina-form");
  if (!pagina) return;
  const U = (typeof USER !== "undefined" && USER) ? USER : sessao();
  if (!U) return;
  const GESTOR = NIVEL3.filter(l => l !== "admin").includes((U.matricula || "").toLowerCase());

  const TIPOS = {
    incidente: {rot: "Incidente",   ico: "🔴", cor: "#D92D20"},
    atencao:   {rot: "Atenção",     ico: "🟡", cor: "#E0A100"},
    info:      {rot: "Informativo", ico: "🔵", cor: "var(--primaria)"},
    resolvido: {rot: "Resolvido",   ico: "🟢", cor: "#12B76A"}
  };
  const AREAS = ["Geral", "MIS", "Facilities"];
  const RESOLVIDO_VISIVEL_H = 24;
  let FILTRO = "Todos", BUSCA = "", MOSTRAR_ARQ = false, VERSAO = null, EDITANDO = false;

  document.head.insertAdjacentHTML("beforeend", `<style>
    .av-wrap{position:fixed;right:22px;top:90px;z-index:40;width:340px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    .av-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--borda);background:var(--sup);color:var(--texto);border-radius:22px;
      padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(40,30,120,.12);transition:.15s;white-space:nowrap}
    .av-pill:hover{border-color:var(--primaria);color:var(--primaria)}
    .av-pill .bol{min-width:18px;height:18px;border-radius:9px;display:inline-grid;place-items:center;font-size:10.5px;color:#fff;background:var(--c,#12B76A);padding:0 5px}
    .av-pill .seta{font-size:10px;opacity:.7}
    .av-pill.alerta{border-color:color-mix(in srgb,var(--c) 55%,var(--borda))}
    .av-pill.alerta .sino{animation:avSino 2.4s infinite;display:inline-block}
    .av-wrap .av-card{width:100%;max-height:calc(100vh - 170px);overflow:auto;animation:avAbre .18s ease}
    @keyframes avAbre{from{opacity:0;transform:translateY(-6px)}}
    .av-wrap .av-cab{flex-wrap:wrap}
    .av-wrap .av-topo{padding-right:86px}
    .av-wrap .av-item h4{font-size:13.5px}.av-wrap .av-item .tx{font-size:12.5px}
    .av-wrap .faq-busca{width:100%}
    .av-wrap .faq-ctrl{width:100%}
    @media(max-width:900px){.av-wrap{right:12px}}
    .av-card{background:var(--sup);border:1px solid var(--borda);border-radius:20px;box-shadow:0 4px 16px rgba(40,30,120,.06);overflow:visible}
    .av-cab{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px 4px}
    .av-cab h2{margin:0;font-size:15.5px}.av-cab p{margin:2px 0 0;color:var(--texto-2);font-size:12px}
    .av-menu{position:relative}
    .av-menu-btn{border:1px solid var(--borda);background:transparent;color:var(--texto-2);border-radius:14px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer}
    .av-menu-btn:hover,.av-menu.aberto .av-menu-btn{color:var(--primaria);border-color:var(--primaria)}
    .av-menu-lista{display:none;position:absolute;left:0;right:auto;top:calc(100% + 6px);z-index:30;min-width:190px;background:var(--sup);border:1px solid var(--borda);
      border-radius:12px;box-shadow:var(--sombra);padding:6px}
    .av-menu.aberto .av-menu-lista{display:block}
    .av-menu-lista button{display:flex;width:100%;gap:8px;align-items:center;border:0;background:none;color:var(--texto);text-align:left;padding:8px 10px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap}
    .av-menu-lista button:hover{background:var(--sup-2,#f3f1ff);color:var(--primaria)}
    .av-menu-lista button[disabled]{opacity:.45;cursor:default}
    .av-btns{display:flex;gap:6px;flex-wrap:wrap}
    .av-btn{border:1px solid var(--borda);background:var(--input);color:var(--texto);border-radius:18px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer}
    .av-btn:hover{border-color:var(--primaria);color:var(--primaria)}
    .av-btn.pri{background:var(--primaria);border-color:var(--primaria);color:#fff}
    .av-lista{padding:8px 14px 4px;display:flex;flex-direction:column;gap:10px}
    .av-item{border-radius:14px;padding:12px 14px 12px 16px;border:1px solid var(--borda);border-left:6px solid var(--c);
      background:color-mix(in srgb,var(--c) 9%,var(--sup));position:relative}
    .av-item.arq{opacity:.6}
    .av-topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--texto-2);padding-right:110px}
    .av-tag{background:var(--c);color:#fff;border-radius:10px;padding:2px 9px;font-weight:700;font-size:11px}
    .av-area{border:1px solid var(--borda);border-radius:10px;padding:1px 8px;font-size:11px;font-weight:600}
    .av-item h4{margin:6px 0 4px;font-size:15px}
    .av-item .tx{font-size:13.5px;line-height:1.5;overflow-wrap:anywhere}
    .av-item .prev{margin-top:6px;font-size:12.5px;font-weight:600}
    .av-acoes{position:absolute;top:8px;right:10px;display:flex;gap:4px}
    .av-acoes button{background:var(--sup);border:1px solid var(--borda);border-radius:8px;cursor:pointer;font-size:12px;padding:3px 7px;color:var(--texto)}
    .av-acoes button:hover{border-color:var(--primaria)}
    .av-vazio{color:var(--texto-2);font-size:13px;padding:6px 2px}
    .faq-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px 6px;border-top:1px dashed var(--borda);margin-top:10px}
    .faq-cab h3{margin:0;font-size:14px}
    .faq-ctrl{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
    .faq-chip{border:1px solid var(--borda);background:var(--input);border-radius:16px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer;color:var(--texto)}
    .faq-chip.ativo{background:var(--primaria);border-color:var(--primaria);color:#fff}
    .faq-busca{border:1px solid var(--borda);background:var(--input);border-radius:16px;padding:6px 12px;font-size:12.5px;width:190px;color:var(--texto)}
    .faq-lista{padding:4px 14px 12px;display:flex;flex-direction:column;gap:8px}
    .faq-lista details{border:1px solid var(--borda);border-radius:12px;background:var(--input)}
    .faq-lista summary{cursor:pointer;padding:9px 10px 9px 14px;font-weight:600;font-size:14px;list-style:none;display:flex;align-items:center;gap:10px}
    .faq-lista summary .pg{flex:1;min-width:0;overflow-wrap:anywhere}
    .faq-dir{display:flex;align-items:center;gap:4px;flex-shrink:0}
    .faq-dir .av-acoes{position:static}
    .faq-lista summary::-webkit-details-marker{display:none}
    .faq-lista summary::before{content:"▸";display:inline-block;color:var(--primaria);transition:transform .15s}
    .faq-lista details[open] summary::before{transform:rotate(90deg)}
    .faq-lista .resp{padding:0 16px 14px 32px;font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
    .av-modal{position:fixed;inset:0;background:rgba(15,13,46,.45);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
    .av-modal .box{background:var(--sup);color:var(--texto);border-radius:18px;padding:22px;width:560px;max-width:100%;box-shadow:var(--sombra)}
    .av-modal h3{margin:0 0 12px}
    .av-modal label{display:block;font-size:12.5px;font-weight:600;color:var(--texto-2);margin:10px 0 4px}
    .av-modal input,.av-modal select,.av-modal textarea{width:100%;box-sizing:border-box;border:1.5px solid var(--borda);border-radius:10px;padding:9px 11px;background:var(--input);color:var(--texto);font:inherit}
    .av-modal .lin{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .av-modal .rod{display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:8px}
    .av-modal .err{color:var(--erro);font-size:12.5px;min-height:16px}
    .av-vivo{font-size:10.5px;color:var(--texto-2);padding:0 16px 8px;text-align:right;opacity:.8}
    .av-reabrir{display:flex;align-items:center;gap:10px;margin:8px 14px 0;padding:10px 14px;border-radius:14px;cursor:pointer;
      border:1px solid color-mix(in srgb,var(--c) 40%,var(--borda));background:color-mix(in srgb,var(--c) 10%,var(--sup));font-size:13px;font-weight:600}
    .av-reabrir:hover{border-color:var(--c)}
    .av-reabrir .sino{font-size:18px;animation:avSino 2.4s infinite}
    .av-reabrir .ver{margin-left:auto;color:var(--primaria);font-size:12.5px}
    @keyframes avSino{0%,80%,100%{transform:rotate(0)}85%{transform:rotate(14deg)}90%{transform:rotate(-12deg)}95%{transform:rotate(8deg)}}
    /* ---------- POP-UP ---------- */
    .pop-fundo{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:18px;
      background:rgba(15,13,46,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:popFundo .25s ease}
    .pop{width:600px;max-width:100%;max-height:calc(100vh - 36px);display:flex;flex-direction:column;background:var(--sup);color:var(--texto);
      border-radius:26px;overflow:hidden;box-shadow:0 30px 80px rgba(15,13,46,.45);animation:popEntra .35s cubic-bezier(.2,.9,.3,1.2)}
    .pop-topo{position:relative;padding:26px 28px 22px;color:#fff;background:linear-gradient(125deg,#17145E 0%,var(--cor-pop) 120%);overflow:hidden}
    .pop-topo::before{content:"";position:absolute;right:-60px;top:-70px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.09)}
    .pop-topo::after{content:"";position:absolute;right:90px;bottom:-90px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06)}
    .pop-ic{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;background:rgba(255,255,255,.16);
      border:1px solid rgba(255,255,255,.25);margin-bottom:12px;position:relative;z-index:1}
    .pop-topo h2{margin:0;font-size:21px;position:relative;z-index:1}
    .pop-topo p{margin:4px 0 0;font-size:13px;opacity:.85;position:relative;z-index:1}
    .pop-x{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:0;cursor:pointer;
      background:rgba(255,255,255,.16);color:#fff;font-size:20px;line-height:1;display:grid;place-items:center;transition:.15s}
    .pop-x:hover{background:rgba(255,255,255,.3);transform:rotate(90deg)}
    .pop-corpo{padding:18px 22px 6px;overflow:auto;display:flex;flex-direction:column;gap:12px}
    .pop-item{border-radius:16px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--c) 30%,var(--borda));
      background:color-mix(in srgb,var(--c) 8%,var(--sup));border-left:6px solid var(--c)}
    .pop-item .av-topo{padding-right:0}
    .pop-item h4{margin:8px 0 4px;font-size:16px}
    .pop-item .tx{font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
    .pop-prev{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 11px;border-radius:20px;font-size:12.5px;font-weight:700;
      background:color-mix(in srgb,var(--c) 16%,var(--sup));color:var(--texto)}
    .pop-rod{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 22px 20px;border-top:1px solid var(--borda);margin-top:10px}
    .pop-rod small{color:var(--texto-2);font-size:12px}
    .pop-ok{border:0;border-radius:14px;padding:11px 20px;font-weight:700;font-size:14px;cursor:pointer;color:#fff;background:var(--primaria);
      box-shadow:0 8px 20px color-mix(in srgb,var(--primaria) 35%,transparent);transition:.15s}
    .pop-ok:hover{transform:translateY(-1px);filter:brightness(1.08)}
    .pop-saindo{animation:popSai .2s ease forwards}
    @keyframes popFundo{from{opacity:0}}
    @keyframes popEntra{from{opacity:0;transform:translateY(24px) scale(.94)}}
    @keyframes popSai{to{opacity:0}}
    @media(max-width:560px){.pop-topo{padding:22px 20px 18px}.pop-corpo{padding:14px}.pop-ok{width:100%}}
  </style>`);

  /* widget compacto no canto superior direito: o formulário fica sozinho no meio da tela */
  const wrap = document.createElement("section");
  wrap.className = "av-wrap";
  document.body.appendChild(wrap);
  let ABERTO = false;
  const posicionar = () => { const t = document.querySelector(".topo"); const r = t ? t.getBoundingClientRect() : null;
    wrap.style.top = ((r ? Math.max(r.bottom, 0) : 70) + 14) + "px"; };
  posicionar(); window.addEventListener("resize", posicionar); window.addEventListener("scroll", posicionar, {passive: true});

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const LT = String.fromCharCode(60), GT = String.fromCharCode(62);
  const texto = t => esc(t || "").replace(/\n/g, LT + "br" + GT).replace(/(https?:\/\/[^\s]+)/g, u => LT + 'a href="' + u + '" target="_blank" rel="noopener"' + GT + u + LT + "/a" + GT);
  const horasDesde = s => s ? (Date.now() - paraData(s).getTime()) / 36e5 : 1e9;
  function lerBase() { const db = carregarDB(); db.avisos = db.avisos || []; db.faq = db.faq || []; return db; }
  function salvarBase(fn, msgOk) {
    try { const db = lerBase(); fn(db); gravarDB(db); toast(msgOk); render(); }
    catch (e) { toast(/salvar no servidor/.test(e.message) ? "Não foi possível salvar. Somente a gestão pode alterar Avisos e FAQ." : e.message); }
  }
  const visivel = a => a.tipo !== "resolvido" || horasDesde(a.resolvido_em || a.atualizado_em) <= RESOLVIDO_VISIVEL_H;
  const ORDEM = ["incidente", "atencao", "info", "resolvido"];
  /* avisos que vão para o pop-up: os ativos (não resolvidos) */
  const ativosPop = db => (db.avisos || []).filter(a => a.tipo !== "resolvido")
    .sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || (b.atualizado_em || "").localeCompare(a.atualizado_em || ""));
  /* "assinatura": se um aviso for criado ou editado, o pop-up volta a aparecer */
  const assinatura = lista => lista.map(a => a.id + "@" + (a.atualizado_em || "")).join("|");
  const CHAVE_VISTO = "portal_avisos_vistos_" + (U.matricula || "").toLowerCase();
  const jaViu = ass => { try { return sessionStorage.getItem(CHAVE_VISTO) === ass; } catch (e) { return false; } };
  const marcarVisto = ass => { try { sessionStorage.setItem(CHAVE_VISTO, ass); } catch (e) {} };
  let POP_ABERTO = false;

  function abrirPopup(lista, preview = false) {
    if (!lista.length || POP_ABERTO) return;
    POP_ABERTO = true;
    const principal = TIPOS[lista[0].tipo] || TIPOS.info;
    const titulo = lista.length > 1 ? `${lista.length} avisos importantes` : lista[0].tipo === "incidente" ? "Instabilidade em andamento"
      : lista[0].tipo === "atencao" ? "Atenção" : "Comunicado";
    const fundo = document.createElement("div");
    fundo.className = "pop-fundo";
    fundo.innerHTML = `<div class="pop" role="dialog" aria-modal="true" aria-labelledby="popTit" style="--cor-pop:${principal.cor}">
      <div class="pop-topo"><button class="pop-x" title="Fechar (Esc)" aria-label="Fechar">×</button>
        <div class="pop-ic">${lista[0].tipo === "incidente" ? "⚠️" : lista[0].tipo === "atencao" ? "🔔" : "📢"}</div>
        <h2 id="popTit">${esc(titulo)}</h2>
        <p>Confira antes de abrir seu chamado — pode ser que sua dúvida já esteja aqui.</p></div>
      <div class="pop-corpo">${lista.map(a => { const t = TIPOS[a.tipo] || TIPOS.info;
        return `<div class="pop-item" style="--c:${t.cor}">
          <div class="av-topo"><span class="av-tag">${t.ico} ${t.rot}</span><span class="av-area">${esc(a.area || "Geral")}</span>
            <span>Atualizado em ${fmt(a.atualizado_em)}</span></div>
          <h4>${esc(a.titulo)}</h4>${a.texto ? `<div class="tx">${texto(a.texto)}</div>` : ""}
          ${a.previsao ? `<div class="pop-prev">⏱ Previsão de normalização: ${esc(a.previsao)}</div>` : ""}</div>`; }).join("")}</div>
      <div class="pop-rod"><small>${preview ? "👁 Pré-visualização: é assim que os usuários veem." : "Você pode rever este aviso no botão 🔔 no canto superior direito."}</small>
        <button class="pop-ok">Entendi, continuar</button></div></div>`;
    document.body.appendChild(fundo);
    const ok = fundo.querySelector(".pop-ok"); ok.focus();
    const fechar = () => {
      if (!preview) marcarVisto(assinatura(lista));
      document.removeEventListener("keydown", tecla);
      fundo.classList.add("pop-saindo");
      setTimeout(() => { fundo.remove(); POP_ABERTO = false; }, 190);
    };
    const tecla = e => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    fundo.querySelector(".pop-x").onclick = fechar;
    ok.onclick = fechar;
    fundo.addEventListener("click", e => { if (e.target === fundo) fechar(); });
  }
  /* usuário comum: abre o pop-up se houver aviso novo/alterado que ele ainda não fechou */
  function popupSeNecessario() {
    if (GESTOR) return;
    let db; try { db = lerBase(); } catch (e) { return; }
    const lista = ativosPop(db);
    if (lista.length && !jaViu(assinatura(lista))) abrirPopup(lista);
  }

  function render() {
    let db; try { db = lerBase(); } catch (e) { return; }
    const avisos = db.avisos.slice().sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo)
      || (b.atualizado_em || "").localeCompare(a.atualizado_em || ""));
    const listaAv = avisos.filter(a => MOSTRAR_ARQ || visivel(a));
    const faq = db.faq.filter(f => (FILTRO === "Todos" || f.area === FILTRO || f.area === "Geral")
      && (!BUSCA || (f.pergunta + " " + f.resposta).toLowerCase().includes(BUSCA)));

    const ativos = ativosPop(db);
    if (!GESTOR && !ativos.length && !db.faq.length) { wrap.innerHTML = ""; return; }
    const corPill = ativos.length ? (TIPOS[ativos[0].tipo] || TIPOS.info).cor : "#12B76A";
    const pill = `<button class="av-pill ${ativos.length ? "alerta" : ""}" data-acao="toggle" style="--c:${corPill}" title="${ABERTO ? "Recolher" : "Abrir avisos e dúvidas"}">
      <span class="sino">${ativos.length ? "🔔" : "✅"}</span>${GESTOR ? "Avisos e FAQ" : ativos.length ? "Avisos e dúvidas" : "Dúvidas frequentes"}
      ${ativos.length ? `<span class="bol">${ativos.length}</span>` : ""}<span class="seta">${ABERTO ? "▲" : "▼"}</span></button>`;
    if (!ABERTO) { wrap.innerHTML = pill; return; }

    const acoesAv = a => !GESTOR ? "" : `<div class="av-acoes">
      ${a.tipo !== "resolvido" ? `<button title="Marcar como resolvido" data-acao="resolver" data-id="${a.id}">✅</button>` : `<button title="Reabrir" data-acao="reabrir" data-id="${a.id}">↩</button>`}
      <button title="Editar" data-acao="editar-av" data-id="${a.id}">✏️</button>
      <button title="Excluir" data-acao="excluir-av" data-id="${a.id}">🗑</button></div>`;
    const acoesFaq = (f, i, n) => !GESTOR ? "" : `<div class="av-acoes">
      <button title="Subir" data-acao="subir" data-id="${f.id}" ${i === 0 ? "disabled" : ""}>▲</button>
      <button title="Descer" data-acao="descer" data-id="${f.id}" ${i === n - 1 ? "disabled" : ""}>▼</button>
      <button title="Editar" data-acao="editar-faq" data-id="${f.id}">✏️</button>
      <button title="Excluir" data-acao="excluir-faq" data-id="${f.id}">🗑</button></div>`;

    wrap.innerHTML = pill + `<div class="av-card">
      <div class="av-cab"><div><h2>${GESTOR ? "📢 Avisos e dúvidas frequentes" : "❓ Dúvidas frequentes"}</h2>
        <p>${GESTOR ? "Avisos ativos aparecem em pop-up para os usuários." : "Respostas rápidas — confira antes de abrir um chamado."}</p></div>
        ${GESTOR ? `<div class="av-menu" id="avMenu"><button class="av-menu-btn" data-acao="menu" title="Gerenciar avisos e perguntas">⚙ Gerenciar ▾</button>
          <div class="av-menu-lista">
            <button data-acao="novo-av">📢 Novo aviso</button>
            <button data-acao="nova-faq">❓ Nova pergunta</button>
            <button data-acao="preview" ${ativos.length ? "" : "disabled"}>👁 Ver pop-up do usuário</button>
            <button data-acao="arq">🗂 ${MOSTRAR_ARQ ? "Ocultar encerrados" : "Ver encerrados"}</button></div></div>` : ""}</div>
      ${!GESTOR ? (ativos.length ? `<div class="av-reabrir" data-acao="ver-pop" style="--c:${(TIPOS[ativos[0].tipo] || TIPOS.info).cor}">
          <span class="sino">🔔</span><span>${ativos.length === 1 ? esc(ativos[0].titulo) : ativos.length + " avisos ativos no momento"}</span><span class="ver">Ver aviso ›</span></div>`
        : `<div class="av-lista"><div class="av-vazio">✅ Nenhum aviso no momento — todos os sistemas operando normalmente.</div></div>`) : `
      <div class="av-lista">${listaAv.length ? listaAv.map(a => {
        const t = TIPOS[a.tipo] || TIPOS.info;
        return `<div class="av-item ${visivel(a) ? "" : "arq"}" style="--c:${t.cor}">${acoesAv(a)}
          <div class="av-topo"><span class="av-tag">${t.ico} ${t.rot}</span><span class="av-area">${esc(a.area || "Geral")}</span>
            <span>Atualizado em ${fmt(a.atualizado_em)}${a.atualizado_por_nome ? " por " + esc(a.atualizado_por_nome) : ""}</span></div>
          <h4>${esc(a.titulo)}</h4>
          ${a.texto ? `<div class="tx">${texto(a.texto)}</div>` : ""}
          ${a.previsao && a.tipo !== "resolvido" ? `<div class="prev">⏱ Previsão de normalização: ${esc(a.previsao)}</div>` : ""}
          ${a.tipo === "resolvido" && a.resolvido_em ? `<div class="prev">✔ Normalizado em ${fmt(a.resolvido_em)}</div>` : ""}</div>`;
      }).join("") : `<div class="av-vazio">✅ Nenhum aviso no momento — todos os sistemas operando normalmente.</div>`}</div>`}

      <div class="faq-cab"><h3>${GESTOR ? "❓ Perguntas frequentes" : "Perguntas"}</h3>
        <div class="faq-ctrl">${["Todos", "MIS", "Facilities"].map(f => `<button class="faq-chip ${FILTRO === f ? "ativo" : ""}" data-acao="filtro" data-f="${f}">${f}</button>`).join("")}
          <input class="faq-busca" id="faqBusca" placeholder="🔎 Buscar dúvida" value="${esc(BUSCA)}"></div></div>
      <div class="faq-lista">${faq.length ? faq.map(f => `<details>
          <summary><span class="pg">${esc(f.pergunta)}</span><span class="faq-dir"><span class="av-area">${esc(f.area || "Geral")}</span>${acoesFaq(f, db.faq.indexOf(f), db.faq.length)}</span></summary>
          <div class="resp">${texto(f.resposta)}</div></details>`).join("")
        : `<div class="av-vazio">${db.faq.length ? "Nenhuma pergunta encontrada para este filtro." : "Nenhuma pergunta cadastrada ainda."}</div>`}</div>
      <div class="av-vivo">🟢 Atualiza automaticamente</div></div>`;

    const busca = wrap.querySelector("#faqBusca");
    busca.oninput = () => { BUSCA = busca.value.trim().toLowerCase(); const pos = busca.selectionStart; render();
      const b2 = wrap.querySelector("#faqBusca"); b2.focus(); b2.setSelectionRange(pos, pos); };
  }

  function modal(html, aoSalvar) {
    EDITANDO = true;
    const m = document.createElement("div"); m.className = "av-modal";
    m.innerHTML = `<div class="box">${html}<div class="rod"><span class="err" id="avErr"></span>
      <span><button class="av-btn" data-x>Cancelar</button> <button class="av-btn pri" data-ok>Salvar</button></span></div></div>`;
    document.body.appendChild(m);
    const fechar = () => { m.remove(); EDITANDO = false; };
    m.querySelector("[data-x]").onclick = fechar;
    m.onclick = e => { if (e.target === m) fechar(); };
    m.querySelector("[data-ok]").onclick = () => { const r = aoSalvar(m); if (r) m.querySelector("#avErr").textContent = r; else fechar(); };
    const primeiro = m.querySelector("input,textarea,select"); if (primeiro) primeiro.focus();
  }
  const opts = (lista, v) => lista.map(([k, r]) => `<option value="${k}" ${k === v ? "selected" : ""}>${r}</option>`).join("");

  function editarAviso(a) {
    a = a || {tipo: "incidente", area: "MIS"};
    modal(`<h3>${a.id ? "Editar aviso" : "Novo aviso"}</h3>
      <div class="lin"><div><label>Tipo</label><select id="fTipoAv">${opts(Object.entries(TIPOS).map(([k, t]) => [k, t.ico + " " + t.rot]), a.tipo)}</select></div>
        <div><label>Área afetada</label><select id="fAreaAv">${opts(AREAS.map(x => [x, x]), a.area)}</select></div></div>
      <label>Título *</label><input id="fTitAv" maxlength="140" value="${esc(a.titulo || "")}" placeholder="Ex.: Instabilidade no Databricks – dashboards do MIS desatualizados">
      <label>Descrição</label><textarea id="fTxtAv" rows="4" placeholder="O que está acontecendo, o que foi afetado e o que o usuário deve fazer.">${esc(a.texto || "")}</textarea>
      <label>Previsão de normalização (opcional)</label><input id="fPrevAv" maxlength="80" value="${esc(a.previsao || "")}" placeholder="Ex.: hoje até 15h">`,
      m => {
        const titulo = m.querySelector("#fTitAv").value.trim();
        if (titulo.length < 4) return "Informe um título.";
        const dados = {tipo: m.querySelector("#fTipoAv").value, area: m.querySelector("#fAreaAv").value, titulo,
          texto: m.querySelector("#fTxtAv").value.trim(), previsao: m.querySelector("#fPrevAv").value.trim()};
        salvarBase(db => {
          const agora = agoraStr(), quem = {atualizado_em: agora, atualizado_por: U.matricula, atualizado_por_nome: U.nome};
          if (a.id) {
            const x = db.avisos.find(y => y.id === a.id); if (!x) throw new Error("Aviso não encontrado (foi excluído?).");
            const virou = dados.tipo === "resolvido" && x.tipo !== "resolvido";
            Object.assign(x, dados, quem, virou ? {resolvido_em: agora} : {}, dados.tipo !== "resolvido" ? {resolvido_em: null} : {});
          } else db.avisos.push({id: novoId(), ...dados, ...quem, criado_em: agora, criado_por: U.matricula, resolvido_em: dados.tipo === "resolvido" ? agora : null});
        }, a.id ? "Aviso atualizado." : "Aviso publicado.");
      });
  }
  function editarFaq(f) {
    f = f || {area: "Geral"};
    modal(`<h3>${f.id ? "Editar pergunta" : "Nova pergunta"}</h3>
      <label>Área</label><select id="fAreaFaq">${opts(AREAS.map(x => [x, x]), f.area)}</select>
      <label>Pergunta *</label><input id="fPergFaq" maxlength="200" value="${esc(f.pergunta || "")}" placeholder="Ex.: O dashboard está desatualizado, devo abrir chamado?">
      <label>Resposta *</label><textarea id="fRespFaq" rows="6" placeholder="Resposta objetiva. Links (https://...) viram clicáveis.">${esc(f.resposta || "")}</textarea>`,
      m => {
        const pergunta = m.querySelector("#fPergFaq").value.trim(), resposta = m.querySelector("#fRespFaq").value.trim();
        if (pergunta.length < 4) return "Informe a pergunta.";
        if (resposta.length < 2) return "Informe a resposta.";
        const area = m.querySelector("#fAreaFaq").value;
        salvarBase(db => {
          const quem = {atualizado_em: agoraStr(), atualizado_por: U.matricula};
          if (f.id) { const x = db.faq.find(y => y.id === f.id); if (!x) throw new Error("Pergunta não encontrada."); Object.assign(x, {pergunta, resposta, area}, quem); }
          else db.faq.push({id: novoId(), pergunta, resposta, area, ...quem});
        }, f.id ? "Pergunta atualizada." : "Pergunta adicionada.");
      });
  }

  wrap.addEventListener("click", e => {
    const b = e.target.closest("[data-acao]"); if (!b) return;
    const ac = b.dataset.acao, id = b.dataset.id;
    if (ac === "filtro") { FILTRO = b.dataset.f; render(); return; }
    if (ac === "toggle") { ABERTO = !ABERTO; render(); return; }
    if (ac === "ver-pop") { abrirPopup(ativosPop(lerBase())); return; }
    if (ac === "menu") { e.stopPropagation(); wrap.querySelector("#avMenu").classList.toggle("aberto"); return; }
    const menu = wrap.querySelector("#avMenu"); if (menu) menu.classList.remove("aberto");
    if (b.closest("summary")) e.preventDefault();
    if (!GESTOR) return;
    e.preventDefault(); e.stopPropagation();
    const db = lerBase(), av = db.avisos.find(x => x.id === id), fq = db.faq.find(x => x.id === id);
    const quem = () => ({atualizado_em: agoraStr(), atualizado_por: U.matricula, atualizado_por_nome: U.nome});
    if (ac === "novo-av") editarAviso();
    else if (ac === "nova-faq") editarFaq();
    else if (ac === "arq") { MOSTRAR_ARQ = !MOSTRAR_ARQ; render(); }
    else if (ac === "preview") abrirPopup(ativosPop(db), true);
    else if (ac === "editar-av" && av) editarAviso(av);
    else if (ac === "editar-faq" && fq) editarFaq(fq);
    else if (ac === "resolver") salvarBase(d => { Object.assign(d.avisos.find(y => y.id === id), {tipo: "resolvido", resolvido_em: agoraStr()}, quem()); }, "Aviso marcado como resolvido.");
    else if (ac === "reabrir") salvarBase(d => { Object.assign(d.avisos.find(y => y.id === id), {tipo: "incidente", resolvido_em: null}, quem()); }, "Aviso reaberto.");
    else if (ac === "excluir-av" && confirm("Excluir este aviso?")) salvarBase(d => { d.avisos = d.avisos.filter(y => y.id !== id); }, "Aviso excluído.");
    else if (ac === "excluir-faq" && confirm("Excluir esta pergunta?")) salvarBase(d => { d.faq = d.faq.filter(y => y.id !== id); }, "Pergunta excluída.");
    else if (ac === "subir" || ac === "descer") salvarBase(d => {
      const i = d.faq.findIndex(y => y.id === id), j = ac === "subir" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= d.faq.length) return; [d.faq[i], d.faq[j]] = [d.faq[j], d.faq[i]];
    }, "Ordem atualizada.");
  });

  document.addEventListener("click", e => {
    const m = wrap.querySelector("#avMenu"); if (m && !m.contains(e.target)) m.classList.remove("aberto");
    if (!e.target.isConnected) return;   /* elemento acabou de ser redesenhado (ex.: o próprio botão) */
    if (ABERTO && !wrap.contains(e.target) && !e.target.closest(".av-modal, .pop-fundo, .dest")) { ABERTO = false; render(); }
  });
  /* ao escolher MIS/Facilities no formulário, o FAQ filtra sozinho */
  document.addEventListener("click", e => { const d = e.target.closest(".dest"); if (d && d.dataset.d) { FILTRO = d.dataset.d; render(); } });

  async function verificar() {
    if (!MODO_REDE || document.hidden || EDITANDO) return;
    try {
      const r = await fetch("api/db/versao", {cache: "no-store"});
      if (r.status === 401) { sessaoExpirou(); return; }
      if (!r.ok) return;
      const v = (await r.json()).versao;
      if (VERSAO !== null && v !== VERSAO) {
        if (wrap.contains(document.activeElement)) return;
        render();
        popupSeNecessario();
      }
      VERSAO = v;
    } catch (e) {}
  }
  render();
  setTimeout(popupSeNecessario, 350);       /* pop-up ao abrir a tela (usuário comum) */
  verificar();
  setInterval(verificar, 15000);
  document.addEventListener("visibilitychange", verificar);
})();