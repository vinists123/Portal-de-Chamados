/* ==========================================================================
   INTERATIVO (v6.9)
   1) Quadro do time / Minhas demandas: filtro de RESPONSÁVEL com seleção múltipla
      (ex.: "Vinicius" + "Sem responsável"). Fica salvo ao trocar de aba.
   2) Análises: FILTRO CRUZADO estilo Power BI. Clique numa barra, fatia, linha ou
      coluna (ex.: "Ajustes") e o painel inteiro passa a mostrar só aquilo.
      Ctrl+clique soma mais de um valor. Clique de novo (ou no ✕) para tirar.
   ========================================================================== */
(function () {
  const LT = String.fromCharCode(60), GT = String.fromCharCode(62);
  const tag = (t, attrs, dentro) => `${LT}${t}${attrs ? " " + attrs : ""}${GT}${dentro || ""}${LT}/${t}${GT}`;
  const U = (typeof USER !== "undefined" && USER) ? USER : null;
  const EU = ((U && U.matricula) || "").toLowerCase();

  /* ======================================================================
     1) QUADRO: responsáveis com seleção múltipla
     ====================================================================== */
  if (typeof filtradas === "function" && document.getElementById("fResp") && typeof DEMANDAS !== "undefined") {
    const sel = document.getElementById("fResp");
    const CHAVE = "portal_resp_multi_" + (typeof MODO !== "undefined" ? MODO : "") + "_" + EU;
    let ESCOLHIDOS = new Set((() => { try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch (e) { return []; } })());
    /* se havia um responsável no filtro antigo (lista simples), traz para a seleção múltipla */
    if (!ESCOLHIDOS.size && sel.value) ESCOLHIDOS.add(sel.value);
    const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify([...ESCOLHIDOS])); } catch (e) {} };
    const ROT = {"__eu": "Atribuídas a mim", "__sem": "Sem responsável"};
    const rotulo = v => ROT[v] || v;

    document.head.insertAdjacentHTML("beforeend", tag("style", "", `
      .rm{position:relative;display:inline-block}
      .rm-btn{display:flex;align-items:center;gap:8px;min-width:210px;max-width:280px;justify-content:space-between;cursor:pointer;
        border:1px solid var(--borda);background:var(--input,#fff);color:var(--texto);border-radius:12px;padding:8px 12px;font:inherit;font-size:13px}
      .rm-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rm-btn b{background:var(--primaria);color:#fff;border-radius:9px;padding:0 7px;font-size:11px}
      .rm-btn:hover,.rm.aberto .rm-btn{border-color:var(--primaria)}
      .rm-pn{display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:50;width:290px;background:var(--sup);color:var(--texto);
        border:1px solid var(--borda);border-radius:14px;box-shadow:0 14px 40px rgba(15,13,46,.22);padding:8px}
      .rm.aberto .rm-pn{display:block}
      .rm-pn input[type=search]{width:100%;box-sizing:border-box;border:1px solid var(--borda);border-radius:10px;padding:7px 10px;margin-bottom:6px;
        background:var(--input,#fff);color:var(--texto);font:inherit;font-size:12.5px}
      .rm-lista{max-height:300px;overflow:auto}
      .rm-op{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer;font-size:13px}
      .rm-op:hover{background:var(--sup-2,#F3F1FF)}
      .rm-op input{accent-color:var(--primaria);width:15px;height:15px;margin:0}
      .rm-op.esp{font-weight:600}
      .rm-sep{height:1px;background:var(--borda);margin:4px 2px}
      .rm-rod{display:flex;justify-content:space-between;gap:6px;padding:6px 2px 2px}
      .rm-rod button{border:0;background:none;color:var(--primaria);font-weight:700;cursor:pointer;font-size:12.5px}`));

    const caixa = document.createElement("div");
    caixa.className = "rm";
    sel.insertAdjacentElement("afterend", caixa);
    sel.style.display = "none";

    const nomes = () => [...new Set(DEMANDAS.map(d => d.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    function textoBotao() {
      if (!ESCOLHIDOS.size) return "Todos os responsáveis";
      const l = [...ESCOLHIDOS].map(rotulo);
      return l.length === 1 ? l[0] : l[0].split(" ")[0] + " + " + (l.length - 1);
    }
    function desenhar(manterAberto) {
      const aberto = manterAberto && caixa.classList.contains("aberto");
      const busca = (caixa.querySelector("input[type=search]") || {}).value || "";
      const op = (v, esp) => tag("label", `class="rm-op${esp ? " esp" : ""}" data-v="${esc(v)}"`,
        `${LT}input type="checkbox" ${ESCOLHIDOS.has(v) ? "checked" : ""}${GT}` + tag("span", "", esc(rotulo(v))));
      const lista = nomes().filter(n => !busca || n.toLowerCase().includes(busca.toLowerCase()));
      caixa.innerHTML = tag("button", `type="button" class="rm-btn" title="Escolha um ou mais responsáveis"`,
          tag("span", "", esc(textoBotao())) + (ESCOLHIDOS.size > 1 ? tag("b", "", ESCOLHIDOS.size) : "") + tag("span", "", "▾"))
        + tag("div", `class="rm-pn"`,
          `${LT}input type="search" placeholder="🔎 Buscar responsável" value="${esc(busca)}"${GT}`
          + tag("div", `class="rm-lista"`, op("__eu", true) + op("__sem", true) + tag("div", `class="rm-sep"`) + lista.map(n => op(n)).join(""))
          + tag("div", `class="rm-rod"`, tag("button", `type="button" data-a="limpar"`, "Limpar") + tag("button", `type="button" data-a="ok"`, "Aplicar ✓")));
      if (aberto) caixa.classList.add("aberto");
      const b = caixa.querySelector("input[type=search]");
      b.oninput = () => { const pos = b.selectionStart; desenhar(true); const n = caixa.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(pos, pos); };
    }
    caixa.addEventListener("click", e => {
      if (e.target.closest(".rm-btn")) { caixa.classList.toggle("aberto"); return; }
      const a = e.target.closest("[data-a]");
      if (a) { if (a.dataset.a === "limpar") { ESCOLHIDOS.clear(); aplicar(true); } else caixa.classList.remove("aberto"); return; }
      const opc = e.target.closest(".rm-op");
      if (opc && e.target.tagName === "INPUT") {
        const v = opc.dataset.v;
        e.target.checked ? ESCOLHIDOS.add(v) : ESCOLHIDOS.delete(v);
        aplicar(true);
      }
    });
    document.addEventListener("click", e => { if (e.target.isConnected && !caixa.contains(e.target)) caixa.classList.remove("aberto"); });
    function aplicar(manter) { salvar(); renderQuadro(); desenhar(manter); }

    /* o filtro original de responsável fica sempre vazio; quem filtra agora é a seleção múltipla */
    const _filtradas = filtradas;
    filtradas = function () {
      sel.value = "";
      const l = _filtradas.apply(this, arguments);
      if (!ESCOLHIDOS.size) return l;
      return l.filter(d => [...ESCOLHIDOS].some(v =>
        v === "__sem" ? !d.responsavel : v === "__eu" ? (typeof ehResponsavel === "function" && ehResponsavel(U, d)) : d.responsavel === v));
    };
    if (typeof descricaoFiltro === "function") {
      const _desc = descricaoFiltro;
      descricaoFiltro = function () {
        sel.value = "";
        const base = _desc.apply(this, arguments);
        const r = ESCOLHIDOS.size ? "responsável: " + [...ESCOLHIDOS].map(rotulo).join(", ") : "";
        return [r, base].filter(Boolean).join(" · ");
      };
    }
    if (typeof limparFiltros === "function") {
      const _limpar = limparFiltros;
      limparFiltros = function () { ESCOLHIDOS.clear(); salvar(); _limpar.apply(this, arguments); desenhar(); };
    }
    if (typeof carregar === "function") {
      const _carregar = carregar;
      carregar = function () { _carregar.apply(this, arguments); if (!caixa.classList.contains("aberto")) desenhar(); };
    }
    desenhar();
    try { renderQuadro(); } catch (e) {}
  }

  /* ======================================================================
     2) ANÁLISES: filtro cruzado (clicar no gráfico filtra o painel)
     ====================================================================== */
  if (document.getElementById("painel") && typeof base === "function" && typeof render === "function") {
    const CF = {};   /* dimensão -> Set de valores */
    const opDe = d => (typeof op === "function" ? op(d) : (d.operadora_outro || d.operadora || d.setor || ""));
    const DIM = {
      tipo:        {rot: "Tipo",         f: d => d.tipo_outro || d.tipo},
      solicitante: {rot: "Solicitante",  f: d => d.solicitante_nome},
      operadora:   {rot: "Origem",       f: opDe},
      status:      {rot: "Status",       f: d => d.status},
      responsavel: {rot: "Responsável",  f: d => d.responsavel || "Sem responsável"},
      perfil:      {rot: "Perfil",       f: d => [d.area, d.nivel].filter(Boolean)},
      prioridade:  {rot: "Prioridade",   f: d => d.prioridade},
      complexidade:{rot: "Complexidade", f: d => d.complexidade},
      aging:       {rot: "Backlog",      f: d => faixaAging(d)},
      dia:         {rot: "Dia/hora",     f: d => diaHora(d)}
    };
    const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    function faixaAging(d) {
      if (["Concluído", "Cancelado"].includes(d.status)) return null;
      const x = (Date.now() - paraData(d.dt_abertura).getTime()) / 864e5;
      return x < 2 ? "0–2 dias" : x < 5 ? "3–5 dias" : x < 10 ? "6–10 dias" : x < 20 ? "11–20 dias" : "+20 dias";
    }
    function diaHora(d) { const t = paraData(d.dt_abertura); return `${DIAS[t.getDay()]} ${t.getHours()}h`; }
    /* qual dimensão cada painel representa (pelo título) */
    function dimDoPainel(titulo) {
      const t = (titulo || "").toLowerCase();
      if (/tipo/.test(t)) return "tipo";
      if (/quem mais abre/.test(t)) return "solicitante";
      if (/operadora|setor/.test(t)) return "operadora";
      if (/status/.test(t)) return "status";
      if (/produtividade|respons/.test(t)) return "responsavel";
      if (/perfil/.test(t)) return "perfil";
      if (/envelhecimento/.test(t)) return "aging";
      if (/quando as demandas chegam/.test(t)) return "dia";
      return null;
    }
    const passa = d => Object.entries(CF).every(([k, set]) => {
      if (!set.size) return true;
      const v = DIM[k].f(d);
      return Array.isArray(v) ? v.some(x => set.has(x)) : set.has(v);
    });

    /* aplica o filtro cruzado em todos os números do painel */
    const _base = base;
    base = function () {
      const r = _base.apply(this, arguments);
      if (!Object.values(CF).some(s => s.size)) return r;
      ["todas", "D", "C", "backlog"].forEach(k => { if (Array.isArray(r[k])) r[k] = r[k].filter(passa); });
      const ids = new Set((r.todas || []).map(d => d.id));
      if (Array.isArray(r.hist)) r.hist = r.hist.filter(h => ids.has(h.demanda_id));
      return r;
    };

    document.head.insertAdjacentHTML("beforeend", tag("style", "", `
      #painel [data-tip],#painel .hbar,#painel .tab-an tbody tr{cursor:pointer}
      #painel .hbar:hover .n,#painel .tab-an tbody tr:hover td{color:var(--primaria)}
      #painel .cf-apagado{opacity:.28;transition:opacity .2s}
      #painel .cf-ativo{filter:drop-shadow(0 0 4px rgba(59,47,217,.45))}
      #painel .hbar.cf-ativo .n{font-weight:800;color:var(--primaria)}
      #painel tr.cf-ativo td{background:color-mix(in srgb,var(--primaria) 10%,transparent);font-weight:700}
      .cf-barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0;padding:10px 14px;border-radius:14px;
        background:var(--sup);border:1px solid var(--borda);box-shadow:var(--sombra);font-size:13px}
      .cf-barra .tit{font-weight:700;color:var(--texto-2)}
      .cf-chip{display:inline-flex;align-items:center;gap:6px;background:var(--primaria);color:#fff;border-radius:16px;padding:4px 6px 4px 12px;font-weight:600}
      .cf-chip button{border:0;background:rgba(255,255,255,.25);color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;line-height:1;font-size:12px}
      .cf-barra .lmp{margin-left:auto;border:0;background:none;color:var(--primaria);font-weight:700;cursor:pointer}
      .cf-dica{font-size:11.5px;color:var(--texto-2);margin:10px 2px 0}`));

    const painel = document.getElementById("painel");
    const barra = document.createElement("div");
    painel.insertAdjacentElement("beforebegin", barra);

    const nomeDe = el => {
      const tip = el.getAttribute && el.getAttribute("data-tip");
      if (tip) { const m = tip.match(new RegExp(LT + "b" + GT + "(.*?)" + LT + "/b" + GT)); if (m) return limpar(m[1]); }
      const n = el.querySelector && (el.querySelector(".n") || el.querySelector(".quebra"));
      return n ? limpar(n.getAttribute("title") || n.textContent) : null;
    };
    function limpar(t) {
      const x = document.createElement("textarea"); x.innerHTML = t; return x.value.trim();
    }
    painel.addEventListener("click", e => {
      const alvo = e.target.closest("[data-tip], .hbar, .tab-an tbody tr");
      if (!alvo || !painel.contains(alvo)) return;
      const pn = alvo.closest(".pn"); if (!pn) return;
      const h3 = pn.querySelector("h3"); let dim = dimDoPainel(h3 && h3.textContent);
      /* dentro do painel de TMA: gráfico é por tipo, tabela é por responsável */
      if (/tma previsto/i.test((h3 && h3.textContent) || "")) dim = alvo.tagName === "TR" ? "responsavel" : "tipo";
      if (!dim) return;
      let v = nomeDe(alvo);
      if (dim === "dia" && v) v = v.replace(/:.*$/, "").trim();
      if (!v) return;
      if (dim === "aging" || dim === "dia") v = v.replace(/\s+/g, " ");
      const set = CF[dim] || (CF[dim] = new Set());
      const multi = e.ctrlKey || e.metaKey || e.shiftKey;
      if (set.has(v) && (multi || set.size === 1)) set.delete(v);
      else { if (!multi) set.clear(); set.add(v); }
      render();
    });
    barra.addEventListener("click", e => {
      const b = e.target.closest("[data-k]");
      if (b) { CF[b.dataset.k].delete(b.dataset.v); render(); return; }
      if (e.target.closest(".lmp")) { Object.keys(CF).forEach(k => delete CF[k]); render(); }
    });

    /* destaca o que está selecionado e apaga o resto, como no Power BI */
    function destacar() {
      painel.querySelectorAll(".pn").forEach(pn => {
        const h3 = pn.querySelector("h3"), titulo = (h3 && h3.textContent) || "";
        pn.querySelectorAll("[data-tip], .hbar, .tab-an tbody tr").forEach(el => {
          let dim = dimDoPainel(titulo);
          if (/tma previsto/i.test(titulo)) dim = el.tagName === "TR" ? "responsavel" : "tipo";
          const set = dim && CF[dim];
          el.classList.remove("cf-ativo", "cf-apagado");
          if (!set || !set.size) return;
          let v = nomeDe(el); if (!v) return;
          if (dim === "dia") v = v.replace(/:.*$/, "").trim();
          el.classList.add(set.has(v) ? "cf-ativo" : "cf-apagado");
        });
      });
      const ativos = Object.entries(CF).flatMap(([k, s]) => [...s].map(v => [k, v]));
      barra.className = ativos.length ? "cf-barra" : "cf-dica";
      barra.innerHTML = ativos.length
        ? tag("span", `class="tit"`, "🔎 Filtrado por:") + ativos.map(([k, v]) =>
            tag("span", `class="cf-chip"`, `${esc(DIM[k].rot)}: ${esc(v)} ` + tag("button", `type="button" data-k="${k}" data-v="${esc(v)}" title="Tirar este filtro"`, "✕"))).join("")
          + tag("button", `type="button" class="lmp"`, "✕ Limpar seleção")
        : "💡 Dica: clique em uma barra, fatia ou linha dos gráficos para filtrar o painel inteiro. Ctrl+clique soma mais de um valor.";
    }
    const _render = render;
    render = function () { _render.apply(this, arguments); destacar(); };
    render();
  }
})();
