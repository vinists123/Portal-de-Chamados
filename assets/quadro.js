/* Quadro estilo Planner — usado por minhas.html (solicitante) e quadro.html (time)
   Nível 2: vê e gerencia só o seu escopo (MIS ou Facilities) · Nível 3: vê tudo
   v6.3: indicadores do topo seguem os filtros + lista de verificação (etapas) com % no card
   v6.5: todos os buckets (menos Em Andamento) podem ser recolhidos + filtros ficam salvos ao trocar de aba */
const ADMIN_VIEW = MODO === "todas";
const USER = iniciarPagina(ADMIN_VIEW ? "quadro.html" : "minhas.html", ADMIN_VIEW);
let DEMANDAS = [], CARD_ABERTO = null;

/* ---------- memória da tela (fica salva no navegador de cada pessoa) ---------- */
const CHAVE_TELA = "portal_quadro_" + MODO + "_" + ((USER && USER.matricula) || "").toLowerCase();
const lerTela = () => { try { return JSON.parse(localStorage.getItem(CHAVE_TELA) || "{}"); } catch (e) { return {}; } };
const gravarTela = t => { try { localStorage.setItem(CHAVE_TELA, JSON.stringify(t)); } catch (e) {} };
const TELA = Object.assign({filtros: {}, recolhidos: {"Concluído": true}}, lerTela());
const FILTROS = ["#fBusca", "#fDest", "#fOper", "#fTipo", "#fResp"];
function salvarFiltros() {
  TELA.filtros = {};
  FILTROS.forEach(s => { const el = $(s); if (el && !el.disabled) TELA.filtros[s] = el.value; });
  gravarTela(TELA);
}
/* buckets que podem ser recolhidos (Em Andamento fica sempre aberto) */
const NAO_RECOLHE = ["Em Andamento"];
const ROTULO_BUCKET = {"Em Triagem": "Tarefas em triagem", "Triagem Concluída": "Triagem concluída",
  "Aguardando Solicitante": "Aguardando solicitante", "Concluído": "Tarefas concluídas", "Cancelado": "Tarefas canceladas"};
function alternarBucket(s) { TELA.recolhidos[s] = !TELA.recolhidos[s]; gravarTela(TELA); renderQuadro(); }

document.head.insertAdjacentHTML("beforeend", `<style>
  .tk-prog{display:flex;align-items:center;gap:8px;margin:8px 0 2px}
  .tk-prog .trilho{flex:1;height:7px;border-radius:5px;background:var(--sup-2,#ECEAF8);overflow:hidden}
  .tk-prog .trilho i{display:block;height:100%;border-radius:5px;background:var(--primaria);transition:width .4s ease}
  .tk-prog.cheio .trilho i{background:#12B76A}
  .tk-prog small{font-size:11px;font-weight:700;color:var(--texto-2);white-space:nowrap}
  .tk-prog.cheio small{color:#12B76A}
  .ck-cab{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .ck-cab .pct{font-size:12px;font-weight:700;color:var(--texto-2)}
  .ck-barra{height:8px;border-radius:6px;background:var(--sup-2,#ECEAF8);overflow:hidden;margin:6px 0 10px}
  .ck-barra i{display:block;height:100%;background:var(--primaria);transition:width .35s ease}
  .ck-barra.cheio i{background:#12B76A}
  .ck-item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px}
  .ck-item:hover{background:var(--sup-2,#F3F1FF)}
  .ck-bola{width:20px;height:20px;min-width:20px;border-radius:50%;border:2px solid var(--texto-2);background:transparent;cursor:pointer;
    display:grid;place-items:center;color:#fff;font-size:12px;padding:0;transition:.15s}
  .ck-bola:hover{border-color:var(--primaria)}
  .ck-item.feito .ck-bola{background:var(--primaria);border-color:var(--primaria)}
  .ck-item.feito .ck-txt{text-decoration:line-through;color:var(--texto-2)}
  .ck-txt{flex:1;min-width:0;font-size:13.5px;overflow-wrap:anywhere}
  .ck-acoes{display:flex;gap:2px;opacity:0;transition:opacity .15s}
  .ck-item:hover .ck-acoes{opacity:1}
  .ck-acoes button{border:0;background:none;cursor:pointer;font-size:12px;padding:2px 5px;border-radius:6px;color:var(--texto-2)}
  .ck-acoes button:hover{background:var(--sup);color:var(--primaria)}
  .ck-novo{display:flex;align-items:center;gap:10px;padding:6px 8px}
  .ck-novo .ck-bola{border-style:dashed;cursor:default}
  .ck-novo input{flex:1;border:0;border-bottom:1px solid var(--borda);background:transparent;color:var(--texto);padding:6px 2px;font:inherit;font-size:13.5px}
  .ck-novo input:focus{outline:none;border-bottom-color:var(--primaria)}
  .ck-vazio{font-size:12.5px;color:var(--texto-2);padding:4px 8px}
  .kpis .kpi.filtrado{outline:2px solid color-mix(in srgb,var(--primaria) 35%,transparent)}
  .kpi-filtro{font-size:11.5px;color:var(--texto-2);margin:-6px 0 10px;display:none;align-items:center;gap:10px}
  .kpi-filtro.on{display:flex}
  .kpi-filtro a{color:var(--primaria);font-weight:600;cursor:pointer;text-decoration:none}
  .concl-toggle .seta-b{display:inline-block;transition:transform .15s;margin-right:4px}
  .concl-toggle.aberto .seta-b{transform:rotate(180deg)}
</style>`);

if (USER) {
  const o = (arr, t) => `<option value="">${t}</option>` + arr.map(v => `<option>${esc(v)}</option>`).join("");
  $("#fOper").innerHTML = o(OPCOES.operadoras, "Todas as operadoras");
  const escopo = ADMIN_VIEW ? USER.escopo : null;
  const tipos = escopo === "Facilities" ? OPCOES.solicitacoes_fac : escopo === "MIS" ? OPCOES.tipos : [...OPCOES.tipos, ...OPCOES.solicitacoes_fac];
  $("#fTipo").innerHTML = o(tipos, "Todos os tipos");
  if (escopo) {
    $("#fDest").innerHTML = `<option value="${escopo}">${esc(DESTINOS[escopo].rotulo)}</option>`;
    $("#fDest").disabled = true;
    if (escopo === "Facilities") $("#fOper").remove();
  } else {
    $("#fDest").innerHTML = `<option value="">MIS e Facilities</option>` + Object.keys(DESTINOS).map(k => `<option value="${k}">${esc(DESTINOS[k].rotulo)}</option>`).join("");
  }
  if (ADMIN_VIEW && escopo) document.querySelector(".planner-titulo span:last-child").textContent =
    escopo === "Facilities" ? "Ordens de Serviço · Facilities" : "Ordens de Serviço · MIS (Dados & Insights)";
  if (!ADMIN_VIEW) { $("#exportBtns").remove(); $("#fResp").remove(); }
  /* restaura os filtros salvos (o de responsável é restaurado em carregar(), depois de montar a lista) */
  ["#fBusca", "#fDest", "#fOper", "#fTipo"].forEach(s => {
    const el = $(s), v = TELA.filtros[s];
    if (el && !el.disabled && v !== undefined && (el.tagName !== "SELECT" || [...el.options].some(op => op.value === v))) el.value = v;
  });
  FILTROS.forEach(s => $(s) && ($(s).oninput = () => { salvarFiltros(); renderQuadro(); }));
  $("#kpis").insertAdjacentHTML("afterend", `<div class="kpi-filtro" id="kpiFiltro"></div>`);
  carregar(true);
}

function carregar(primeiraVez) {
  DEMANDAS = listarDemandas(ADMIN_VIEW);
  if ($("#fResp")) {
    const resp = [...new Set(DEMANDAS.map(d => d.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const atual = primeiraVez ? (TELA.filtros["#fResp"] || "") : $("#fResp").value;
    $("#fResp").innerHTML = `<option value="">Todos os responsáveis</option><option value="__eu">Atribuídas a mim</option><option value="__sem">Sem responsável</option>` +
      resp.map(r => `<option>${esc(r)}</option>`).join("");
    $("#fResp").value = [...$("#fResp").options].some(op => op.value === atual) ? atual : "";
  }
  renderQuadro();
  if (CARD_ABERTO && $("#ckBox") && (!document.activeElement || document.activeElement.id !== "ckNovo")) desenharChecklist(CARD_ABERTO);
}
function limparFiltros() {
  FILTROS.forEach(s => { const el = $(s); if (el && !el.disabled) el.value = ""; });
  salvarFiltros(); renderQuadro();
}
function filtradas() {
  const val = s => $(s) ? $(s).value : "";
  const ds = val("#fDest"), b = val("#fBusca").toLowerCase(), op = val("#fOper"), t = val("#fTipo"), r = val("#fResp");
  return DEMANDAS.filter(d => (!b || [d.protocolo, d.resumo, d.solicitante_nome, d.solicitante_email, d.operadora, d.operadora_outro, d.area, d.nivel, d.setor, d.tipo, ...Object.values(d.fac || {})].join(" ").toLowerCase().includes(b))
    && (!ds || destinoDe(d) === ds)
    && (!op || d.operadora === op) && (!t || d.tipo === t)
    && (!r || (r === "__sem" ? !d.responsavel : r === "__eu" ? ehResponsavel(USER, d) : d.responsavel === r)));
}
function descricaoFiltro() {
  const partes = [], val = s => $(s) ? $(s).value : "";
  const r = val("#fResp");
  if (r) partes.push(r === "__eu" ? "atribuídas a mim" : r === "__sem" ? "sem responsável" : "responsável: " + r);
  if (val("#fTipo")) partes.push("tipo: " + val("#fTipo"));
  if (val("#fOper")) partes.push("operadora: " + val("#fOper"));
  if (val("#fDest") && !($("#fDest") && $("#fDest").disabled)) partes.push(DESTINOS[val("#fDest")].rotulo);
  if (val("#fBusca")) partes.push(`busca: "${val("#fBusca")}"`);
  return partes.join(" · ");
}
function barraProgresso(d) {
  const pr = progressoChecklist(d);
  if (!pr) return "";
  return `<div class="tk-prog ${pr.pct === 100 ? "cheio" : ""}" title="${pr.feitos} de ${pr.total} etapas concluídas">
    <span class="trilho"><i style="width:${pr.pct}%"></i></span><small>${pr.pct === 100 ? "✓ " : ""}${pr.pct}% · ${pr.feitos}/${pr.total}</small></div>`;
}
function card(d) {
  const concl = ["Concluído", "Cancelado"].includes(d.status), seg = segundaTexto(d), nAnx = (d.anexos || []).length;
  return `<div class="tk ${concl ? "concl" : ""}" draggable="${ADMIN_VIEW}" data-id="${d.id}" onclick="abrir(${d.id})">
    <div class="tk-corpo">
      <span class="tag ${tagCls(d.tipo)}" title="${esc(d.tipo_outro || d.tipo)}">${esc(d.tipo_outro || d.tipo)}</span><span class="tag-dest ${destinoDe(d) === "Facilities" ? "fac" : ""}">${destinoDe(d) === "Facilities" ? "FACILITIES" : "MIS"}</span>
      <div class="tk-tit" title="${esc(d.protocolo)}-${esc(d.resumo)}"><span class="circ"></span><span>${esc(d.protocolo)}-${esc(d.resumo)}</span></div>
      <div class="tk-info">Solicitante: ${esc(d.solicitante_nome)}<br>E-mail: ${esc(d.solicitante_email)}<br>
        ${d.operadora ? `Operadora: <b>${esc(d.operadora_outro || d.operadora)}</b>` : `Sistema: <b>${esc((d.fac || {}).sistema || "—")}</b>`}
        ${seg ? `<br><span class="tk-seg">${esc(seg)}</span>` : ""}${d.prazo ? `<br>Previsão: ${fmtD(d.prazo)} · TMA prev. ${tmaPrevisto(d)} d` : ""}${tmaRealizado(d) != null ? ` · real. ${tmaRealizado(d)} d` : ""}</div>
      ${barraProgresso(d)}
      ${["Alta", "Urgente"].includes(d.prioridade) ? `<div class="tk-pri" title="Prioridade ${esc(d.prioridade)}">${d.prioridade === "Urgente" ? "!!" : "!"}</div>` : ""}
    </div>
    <div class="tk-rod"><span>${[d.qtd_comentarios ? "💬 " + d.qtd_comentarios : "", nAnx ? "📎 " + nAnx : "", d.complexidade ? "Complex.: " + esc(d.complexidade) : ""].filter(Boolean).join(" · ")}</span>
      ${d.responsavel ? `<span class="avatar" title="${esc(d.responsavel)}">${iniciais(d.responsavel)}</span>` : `<span class="avatar vazio" title="Sem responsável">+</span>`}</div>
  </div>`;
}
function renderQuadro() {
  const lista = filtradas();
  const n = s => lista.filter(d => d.status === s).length;
  const mes = agoraStr().slice(0, 7), aguard = !ADMIN_VIEW ? DEMANDAS.filter(d => d.status === "Aguardando Solicitante").length : 0;
  const desc = descricaoFiltro();
  $("#kpis").innerHTML = [["Em aberto", lista.filter(d => !["Concluído", "Cancelado"].includes(d.status)).length],
    ["Em triagem", n("Em Triagem")], ["Aguardando solicitante", n("Aguardando Solicitante")], ["Em andamento", n("Em Andamento")],
    ["Concluídas no mês", lista.filter(d => d.status === "Concluído" && (d.dt_conclusao || "").startsWith(mes)).length]]
    .map(([l, v]) => `<div class="kpi ${desc ? "filtrado" : ""}"><b>${v}</b>${l}</div>`).join("")
    + (aguard ? `<div class="alerta">⚠ Você tem <b>&nbsp;${aguard}&nbsp;</b> demanda(s) aguardando sua resposta — abra o card e responda nos comentários.</div>` : "");
  const kf = $("#kpiFiltro");
  if (kf) { kf.classList.toggle("on", !!desc); kf.innerHTML = desc ? `<span>🔎 Indicadores filtrados por ${esc(desc)}</span><a onclick="limparFiltros()">✕ Limpar filtros</a>` : ""; }

  $("#board").innerHTML = OPCOES.status.map(s => {
    const cards = lista.filter(d => d.status === s);
    let corpo;
    if (!NAO_RECOLHE.includes(s) && cards.length) {
      const fechado = !!TELA.recolhidos[s];
      corpo = `<div class="concl-toggle ${fechado ? "" : "aberto"}" onclick="alternarBucket('${s}')" title="${fechado ? "Mostrar" : "Ocultar"} os cards">
          <span><span class="seta-b">⌄</span>${esc(ROTULO_BUCKET[s] || s)}</span><span>${cards.length}</span></div>`
        + (fechado ? "" : cards.map(card).join(""));
    } else corpo = cards.map(card).join("") || `<div class="vazio-col">Nenhuma demanda</div>`;
    return `<div class="col" data-status="${s}"><div class="col-h"><span>${s}</span><small>${cards.length}</small></div>${corpo}</div>`;
  }).join("");

  if (!ADMIN_VIEW) return;
  document.querySelectorAll(".tk").forEach(el => {
    el.ondragstart = e => { e.dataTransfer.setData("text/plain", el.dataset.id); el.classList.add("dragging"); };
    el.ondragend = () => el.classList.remove("dragging");
  });
  document.querySelectorAll(".col").forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add("drag"); };
    col.ondragleave = () => col.classList.remove("drag");
    col.ondrop = e => {
      e.preventDefault(); col.classList.remove("drag");
      const id = +e.dataTransfer.getData("text/plain"), status = col.dataset.status, d = DEMANDAS.find(x => x.id === id);
      if (!d || d.status === status) return;
      try { atualizarDemanda(id, {status}); toast(`${d.protocolo} → ${status} · e-mail ao solicitante`); carregar(); }
      catch (err) { toast(err.message); if (err.message.includes("Complexidade")) abrir(id); }
    };
  });
}

/* ---------- Lista de verificação (etapas) ---------- */
function htmlChecklist(d, gere) {
  const l = d.checklist || [], pr = progressoChecklist(d);
  return `<div class="ck-cab"><h4 style="margin:0">☑ Lista de verificação ${pr ? `(${pr.feitos}/${pr.total})` : ""}</h4>
      ${pr ? `<span class="pct">${pr.pct}% concluído</span>` : ""}</div>
    ${pr ? `<div class="ck-barra ${pr.pct === 100 ? "cheio" : ""}"><i style="width:${pr.pct}%"></i></div>` : ""}
    <div id="ckLista">${l.map((it, i) => `<div class="ck-item ${it.feito ? "feito" : ""}">
        <button class="ck-bola" ${gere ? `onclick="ckAcao(${d.id},{tipo:'marcar',item:'${it.id}'})" title="${it.feito ? "Desmarcar" : "Concluir etapa"}"` : "disabled"}>${it.feito ? "✓" : ""}</button>
        <span class="ck-txt" title="${it.feito && it.dt_feito ? "Concluída em " + fmt(it.dt_feito) : ""}">${esc(it.texto)}</span>
        ${gere ? `<span class="ck-acoes">
          <button title="Subir" onclick="ckAcao(${d.id},{tipo:'mover',item:'${it.id}',dir:-1})" ${i === 0 ? "disabled" : ""}>▲</button>
          <button title="Descer" onclick="ckAcao(${d.id},{tipo:'mover',item:'${it.id}',dir:1})" ${i === l.length - 1 ? "disabled" : ""}>▼</button>
          <button title="Editar" onclick="ckEditar(${d.id},'${it.id}')">✏️</button>
          <button title="Excluir" onclick="ckAcao(${d.id},{tipo:'remover',item:'${it.id}'})">🗑</button></span>` : ""}
      </div>`).join("") || (gere ? "" : `<div class="ck-vazio">Nenhuma etapa cadastrada.</div>`)}</div>
    ${gere ? `<div class="ck-novo"><span class="ck-bola"></span><input id="ckNovo" maxlength="200" placeholder="Adicionar uma etapa e apertar Enter"></div>` : ""}`;
}
function desenharChecklist(id, focarNovo) {
  const box = $("#ckBox"); if (!box) return;
  let r; try { r = detalheDemanda(id); } catch (e) { toast(e.message); return; }
  const gere = ADMIN_VIEW && podeGerir(USER, r.demanda);
  box.innerHTML = htmlChecklist(r.demanda, gere);
  const inp = $("#ckNovo");
  if (inp) {
    inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); ckAcao(id, {tipo: "add", texto: inp.value}, true); } };
    if (focarNovo) inp.focus();
  }
}
function ckAcao(id, acao, focarNovo) {
  try { alterarChecklist(id, acao); desenharChecklist(id, focarNovo); carregar(); }
  catch (e) { toast(e.message); }
}
function ckEditar(id, item) {
  const d = (detalheDemanda(id).demanda.checklist || []).find(x => x.id === item); if (!d) return;
  const t = prompt("Editar etapa:", d.texto);
  if (t !== null) ckAcao(id, {tipo: "editar", item, texto: t});
}

function abrir(id) {
  let r; try { r = detalheDemanda(id); } catch (e) { toast(e.message); return; }
  CARD_ABERTO = id;
  const d = r.demanda, aberta = !["Concluído", "Cancelado"].includes(d.status), gere = ADMIN_VIEW && podeGerir(USER, d);
  const op = (arr, v, vazio) => (vazio ? `<option value="">${vazio}</option>` : "") + arr.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  const perfis = carregarDB().perfis, nomeL = l => (perfis[l] && perfis[l].nome) || l;
  const equipe = equipeDe(destinoDe(d)), atualL = (d.responsavel_login || "").toLowerCase();
  const optResp = `<option value="">Sem responsável</option>` + equipe.map(l => `<option value="${esc(l)}" ${l === atualL ? "selected" : ""}>${esc(nomeL(l))}${nomeL(l) === l ? "" : " (" + esc(l) + ")"}</option>`).join("")
    + (d.responsavel && !d.responsavel_login ? `<option value="" selected disabled>${esc(d.responsavel)} (antigo – selecione novamente)</option>` : "");
  $("#modal").innerHTML = `<div class="overlay" onclick="if(event.target===this){CARD_ABERTO=null;fecharModal()}"><div class="drawer">
    <div class="dw-top"><div><div class="dw-prot">${esc(d.protocolo)} · aberta em ${fmt(d.dt_abertura)}</div><h3>${esc(d.resumo)}</h3>
      <span class="tag ${tagCls(d.tipo)}">${esc(d.tipo_outro || d.tipo)}</span> <span class="tag tag-neutro">${esc(d.status)}</span></div>
      <button class="x" onclick="CARD_ABERTO=null;fecharModal()">×</button></div>

    ${gere ? `<div class="sec"><h4>Gestão da demanda</h4><div class="adm">
      <label>Status (bucket)<select id="edStatus">${op(OPCOES.status, d.status)}</select></label>
      <label>Responsável<select id="edResp">${optResp}</select></label>
      <label>Prioridade<select id="edPri">${op(OPCOES.prioridades, d.prioridade)}</select></label>
      <label>Complexidade${destinoDe(d) === "MIS" ? " *" : ""}<select id="edComp">${op(OPCOES.complexidades, d.complexidade, "Não definida")}</select></label>
      <label>Data de chegada da demanda<input id="edChegada" type="date" value="${esc(inicioTMA(d) || "")}"></label>
      <label>Previsão de entrega<input id="edPrazo" type="date" value="${esc(d.prazo || "")}"></label>
      <label style="justify-content:flex-end"><span><input type="checkbox" id="edNotif" checked> Notificar solicitante por e-mail</span></label>
      <label class="full">Comentário para o solicitante<textarea id="edCom" rows="2" placeholder="Ex.: Precisamos que informe o período desejado."></textarea></label>
      <div class="full" style="text-align:right"><button class="btn" onclick="salvar(${d.id})">Salvar</button></div></div></div>` : ""}

    <div class="sec" id="ckBox"></div>

    <div class="sec"><h4>Informações</h4><div class="grid">
      <div class="i"><b>Solicitante</b>${esc(d.solicitante_nome)} (${esc(d.solicitante_matricula)})</div>
      <div class="i"><b>E-mail</b>${esc(d.solicitante_email)}</div>
      <div class="i"><b>Destino</b>${esc(DESTINOS[destinoDe(d)].rotulo)}</div>
      ${destinoDe(d) === "Facilities" ? `<div class="i"><b>Setor</b>${esc(d.setor || "—")}</div>` : `<div class="i"><b>Operadora</b>${esc(d.operadora_outro || d.operadora)}</div>
      <div class="i"><b>${d.nivel ? "Nível solicitante Dados" : "Área Amil"}</b>${esc(d.area || d.nivel || "—")}</div>`}
      <div class="i"><b>Responsável</b>${esc(d.responsavel || "—")}</div><div class="i"><b>Previsão de entrega</b>${fmtD(d.prazo)}</div>
      <div class="i"><b>Data de chegada</b>${fmtD(inicioTMA(d))}</div>
      <div class="i"><b>TMA previsto × realizado</b>${tmaPrevisto(d) != null ? tmaPrevisto(d) + " d" : "—"} × ${tmaRealizado(d) != null ? tmaRealizado(d) + " d" : aberta && d.prazo ? `em curso (${tmaDecorrido(d)} d)` : "—"}</div>
      <div class="i"><b>Prioridade</b>${esc(d.prioridade)}</div><div class="i"><b>Complexidade</b>${esc(d.complexidade || "—")}</div></div></div>

    ${d.fac ? `<div class="sec"><h4>${esc(d.tipo)} · dados do acesso</h4><div class="grid">
      ${CAMPOS_FAC.map(c => `<div class="i"><b>${esc(c.titulo)}</b>${esc(c.tipo === "data" ? fmtD(d.fac[c.id]) : d.fac[c.id] || "—")}</div>`).join("")}</div></div>` : ""}
    ${d.descricao ? `<div class="sec"><h4>${d.fac ? "Observações" : "Descrição detalhada"}</h4><div class="caixa">${esc(d.descricao)}</div></div>` : ""}

    <div class="sec"><h4>Anexos</h4><div class="anexos-lista" id="dwAnexos"><span class="vazio-col">Carregando...</span></div>
      ${aberta ? `<label class="pl-btn" style="margin-top:10px">📎 Adicionar anexo<input type="file" multiple hidden accept="${ANEXO.accept}" onchange="addAnexo(${d.id}, this.files)"></label>` : ""}</div>

    <div class="sec"><h4>Comentários</h4>
      ${r.comentarios.map(c => `<div class="com ${c.perfil === "Solicitante" ? "solic" : "dados"}"><div class="h"><b>${esc(c.autor_nome)}</b> · ${esc(c.perfil)} · ${fmt(c.dt_comentario)}</div>${esc(c.texto).replace(/\n/g, "<br>")}</div>`).join("") || `<div class="vazio-col">Sem comentários.</div>`}
      ${!gere && aberta ? `<div class="dw-com" style="margin-top:8px"><textarea id="novoCom" rows="3" style="width:100%"
        placeholder="${d.status === "Aguardando Solicitante" ? "Responda aqui — a demanda volta para Em Andamento" : "Escreva um comentário para o " + DESTINOS[destinoDe(d)].equipe}"></textarea>
        <div style="text-align:right;margin-top:6px"><button class="btn" onclick="comentar(${d.id})">Enviar comentário</button></div></div>` : ""}</div>

    <div class="sec"><h4>Histórico</h4><div class="tl">${r.historico.map(h => `<div>${fmt(h.dt_evento)} · ${h.status_de ? esc(h.status_de) + " → " : ""}<b>${esc(h.status_para)}</b> · ${esc(h.usuario)}</div>`).join("")}</div></div>
    ${gere && r.emails.length ? `<div class="sec"><h4>E-mails</h4><div class="tl">${r.emails.map(m => `<div class="quebra">${fmt(m.dt_envio)} · ${esc(m.para)} · ${esc(m.assunto)}</div>`).join("")}</div></div>` : ""}
  </div></div>`;
  desenharChecklist(d.id);
  carregarAnexos(d.id);
}
async function carregarAnexos(id) {
  const box = $("#dwAnexos"); if (!box) return;
  try {
    const lista = await AnexosDB.listar(id);
    box.innerHTML = lista.length ? lista.map(a => {
      const url = a.url;
      const thumb = (a.tipo || "").startsWith("image/") ? `<img src="${url}" alt="">` : `<span class="ic">${esc(extensao(a.nome))}</span>`;
      return `<a class="arq" href="${url}" download="${esc(a.nome)}" title="Baixar ${esc(a.nome)}">${thumb}
        <div style="min-width:0"><div class="nm">${esc(a.nome)}</div><div class="tm">${tam(a.tamanho)} · baixar</div></div></a>`;
    }).join("") : `<span class="vazio-col">Nenhum anexo.</span>`;
  } catch (e) { box.innerHTML = `<span class="vazio-col">Não foi possível ler os anexos.</span>`; }
}
async function addAnexo(id, files) {
  try { await adicionarAnexos(id, files); toast("Anexo(s) adicionado(s)."); carregar(); abrir(id); }
  catch (e) { toast(e.message); }
}
function salvar(id) {
  try {
    const selR = $("#edResp"), respLegado = selR.selectedOptions[0] && selR.selectedOptions[0].disabled;
    atualizarDemanda(id, {status: $("#edStatus").value, responsavel_login: respLegado ? undefined : selR.value, prioridade: $("#edPri").value,
      complexidade: $("#edComp").value, prazo: $("#edPrazo").value, dt_chegada: $("#edChegada").value, comentario: $("#edCom").value, notificar: $("#edNotif").checked});
    toast("Demanda atualizada."); carregar(); abrir(id);
  } catch (e) { toast(e.message); }
}
function comentar(id) {
  try { comentarDemanda(id, $("#novoCom").value); toast("Comentário enviado."); carregar(); abrir(id); }
  catch (e) { toast(e.message); }
}
