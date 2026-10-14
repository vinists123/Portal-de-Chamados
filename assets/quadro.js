/* Quadro estilo Planner — usado por minhas.html (solicitante) e quadro.html (time)
   Nível 2: vê e gerencia só o seu escopo (MIS ou Facilities) · Nível 3: vê tudo */
const ADMIN_VIEW = MODO === "todas";
const USER = iniciarPagina(ADMIN_VIEW ? "quadro.html" : "minhas.html", ADMIN_VIEW);
let DEMANDAS = [], MOSTRAR_CONCL = false;

if (USER) {
  const o = (arr, t) => `<option value="">${t}</option>` + arr.map(v => `<option>${esc(v)}</option>`).join("");
  $("#fOper").innerHTML = o(OPCOES.operadoras, "Todas as operadoras");
  const escopo = ADMIN_VIEW ? USER.escopo : null;
  const tipos = escopo === "Facilities" ? OPCOES.solicitacoes_fac : escopo === "MIS" ? OPCOES.tipos : [...OPCOES.tipos, ...OPCOES.solicitacoes_fac];
  $("#fTipo").innerHTML = o(tipos, "Todos os tipos");
  if (escopo) {   /* nível 2: filtro travado no seu escopo */
    $("#fDest").innerHTML = `<option value="${escopo}">${esc(DESTINOS[escopo].rotulo)}</option>`;
    $("#fDest").disabled = true;
    if (escopo === "Facilities") $("#fOper").remove();
  } else {
    $("#fDest").innerHTML = `<option value="">MIS e Facilities</option>` + Object.keys(DESTINOS).map(k => `<option value="${k}">${esc(DESTINOS[k].rotulo)}</option>`).join("");
  }
  if (ADMIN_VIEW && escopo) document.querySelector(".planner-titulo span:last-child").textContent =
    escopo === "Facilities" ? "Ordens de Serviço · Facilities" : "Ordens de Serviço · MIS (Dados & Insights)";
  ["#fBusca", "#fDest", "#fOper", "#fTipo", "#fResp"].forEach(s => $(s) && ($(s).oninput = renderQuadro));
  if (!ADMIN_VIEW) { $("#exportBtns").remove(); $("#fResp").remove(); }
  else if (USER.nivel !== 3) { const lb = [...document.querySelectorAll("#exportBtns a")].find(a => /Limpar/.test(a.textContent)); if (lb) lb.remove(); }
  carregar();
  /* em rede: atualiza o quadro sozinho a cada 60 s (se nenhum card estiver aberto) */
  if (MODO_REDE) setInterval(() => { if (!document.querySelector("#modal .overlay, #modal .center")) { try { carregar(); } catch (e) {} } }, 60000);
}

function carregar() {
  DEMANDAS = listarDemandas(ADMIN_VIEW);
  if ($("#fResp")) {
    const resp = [...new Set(DEMANDAS.map(d => d.responsavel).filter(Boolean))].sort(), atual = $("#fResp").value;
    $("#fResp").innerHTML = `<option value="">Todos os responsáveis</option><option value="__eu">Atribuídas a mim</option><option value="__sem">Sem responsável</option>` +
      resp.map(r => `<option>${esc(r)}</option>`).join("");
    $("#fResp").value = atual;
  }
  renderQuadro();
}
function filtradas() {
  const val = s => $(s) ? $(s).value : "";
  const ds = val("#fDest"), b = val("#fBusca").toLowerCase(), op = val("#fOper"), t = val("#fTipo"), r = val("#fResp");
  return DEMANDAS.filter(d => (!b || [d.protocolo, d.resumo, d.solicitante_nome, d.solicitante_email, d.operadora, d.operadora_outro, d.area, d.nivel, d.setor, d.tipo, ...Object.values(d.fac || {})].join(" ").toLowerCase().includes(b))
    && (!ds || destinoDe(d) === ds)
    && (!op || d.operadora === op) && (!t || d.tipo === t)
    && (!r || (r === "__sem" ? !d.responsavel : r === "__eu" ? ehResponsavel(USER, d) : d.responsavel === r)));
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
      ${["Alta", "Urgente"].includes(d.prioridade) ? `<div class="tk-pri" title="Prioridade ${esc(d.prioridade)}">${d.prioridade === "Urgente" ? "!!" : "!"}</div>` : ""}
    </div>
    <div class="tk-rod"><span>${[d.qtd_comentarios ? "💬 " + d.qtd_comentarios : "", nAnx ? "📎 " + nAnx : "", d.complexidade ? "Complex.: " + esc(d.complexidade) : ""].filter(Boolean).join(" · ")}</span>
      ${d.responsavel ? `<span class="avatar" title="${esc(d.responsavel)}">${iniciais(d.responsavel)}</span>` : `<span class="avatar vazio" title="Sem responsável">+</span>`}</div>
  </div>`;
}
function renderQuadro() {
  const lista = filtradas(), n = s => DEMANDAS.filter(d => d.status === s).length;
  const mes = agoraStr().slice(0, 7), aguard = !ADMIN_VIEW ? n("Aguardando Solicitante") : 0;
  $("#kpis").innerHTML = [["Em aberto", DEMANDAS.filter(d => !["Concluído", "Cancelado"].includes(d.status)).length],
    ["Em triagem", n("Em Triagem")], ["Aguardando solicitante", n("Aguardando Solicitante")], ["Em andamento", n("Em Andamento")],
    ["Concluídas no mês", DEMANDAS.filter(d => d.status === "Concluído" && (d.dt_conclusao || "").startsWith(mes)).length]]
    .map(([l, v]) => `<div class="kpi"><b>${v}</b>${l}</div>`).join("")
    + (aguard ? `<div class="alerta">⚠ Você tem <b>&nbsp;${aguard}&nbsp;</b> demanda(s) aguardando sua resposta — abra o card e responda nos comentários.</div>` : "");

  $("#board").innerHTML = OPCOES.status.map(s => {
    const cards = lista.filter(d => d.status === s);
    let corpo;
    if (s === "Concluído" && cards.length) {
      corpo = `<div class="concl-toggle" onclick="MOSTRAR_CONCL=!MOSTRAR_CONCL;renderQuadro()"><span>${MOSTRAR_CONCL ? "⌃" : "⌄"} Tarefas concluídas</span><span>${cards.length}</span></div>`
        + (MOSTRAR_CONCL ? cards.map(card).join("") : "");
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
      try { atualizarDemanda(id, {status}); toast(`${d.protocolo} → ${status} · e-mail (simulado) ao solicitante`); carregar(); }
      catch (err) { toast(err.message); if (err.message.includes("Complexidade")) abrir(id); }
    };
  });
}
function abrir(id) {
  let r; try { r = detalheDemanda(id); } catch (e) { toast(e.message); return; }
  const d = r.demanda, aberta = !["Concluído", "Cancelado"].includes(d.status), gere = ADMIN_VIEW && podeGerir(USER, d);
  const op = (arr, v, vazio) => (vazio ? `<option value="">${vazio}</option>` : "") + arr.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  /* lista de responsáveis = equipe do escopo da demanda (nome cadastrado de cada login) */
  const perfis = carregarDB().perfis, nomeL = l => (perfis[l] && perfis[l].nome) || l;
  const equipe = equipeDe(destinoDe(d)), atualL = (d.responsavel_login || "").toLowerCase();
  const optResp = `<option value="">Sem responsável</option>` + equipe.map(l => `<option value="${esc(l)}" ${l === atualL ? "selected" : ""}>${esc(nomeL(l))}${nomeL(l) === l ? "" : " (" + esc(l) + ")"}</option>`).join("")
    + (d.responsavel && !d.responsavel_login ? `<option value="" selected disabled>${esc(d.responsavel)} (antigo – selecione novamente)</option>` : "");
  $("#modal").innerHTML = `<div class="overlay" onclick="if(event.target===this)fecharModal()"><div class="drawer">
    <div class="dw-top"><div><div class="dw-prot">${esc(d.protocolo)} · aberta em ${fmt(d.dt_abertura)}</div><h3>${esc(d.resumo)}</h3>
      <span class="tag ${tagCls(d.tipo)}">${esc(d.tipo_outro || d.tipo)}</span> <span class="tag tag-neutro">${esc(d.status)}</span></div>
      <button class="x" onclick="fecharModal()">×</button></div>

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
    ${gere && r.emails.length ? `<div class="sec"><h4>E-mails (simulados)</h4><div class="tl">${r.emails.map(m => `<div class="quebra">${fmt(m.dt_envio)} · ${esc(m.para)} · ${esc(m.assunto)}</div>`).join("")}</div></div>` : ""}
  </div></div>`;
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
