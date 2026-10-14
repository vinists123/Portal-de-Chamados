/* ==========================================================================
   ANÁLISES DE PRODUTIVIDADE
   - Nível 3 (gestão): vê todas as demandas
   - Nível 2: vê somente as demandas ATRIBUÍDAS a ele, dentro do seu escopo (MIS ou Facilities)
   Gráficos em SVG puro (não depende de internet nem de biblioteca externa)
   ========================================================================== */
const USER = iniciarPagina("analises.html", "analise");
const INDIVIDUAL = !!USER && USER.nivel !== 3;
const F = {periodo: "30", destino: INDIVIDUAL ? USER.escopo : "", operadora: "", responsavel: ""};
const FINAIS = ["Concluído", "Cancelado"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ---------- helpers ---------- */
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const cores = () => [css("--primaria"), css("--teal"), css("--ouro"), css("--lav"), "#E86FA8", "#5FA8FF", "#9B8CFF", "#7BD88F", "#FF9F6B"];
const horas = (a, b) => (paraData(b) - paraData(a)) / 36e5;
const dias = (a, b) => horas(a, b) / 24;
const n1 = v => isFinite(v) ? v.toLocaleString("pt-BR", {maximumFractionDigits: 1, minimumFractionDigits: v < 10 && v % 1 ? 1 : 0}) : "—";
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const mediana = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const contar = (arr, fn) => { const m = {}; arr.forEach(x => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const fmtTempo = h => !isFinite(h) ? "—" : h < 24 ? `${n1(h)} h` : `${n1(h / 24)} d`;
const op = d => d.operadora_outro || d.operadora || (destinoDe(d) === "Facilities" ? (d.setor || "Facilities") : "");

/* ---------- tooltip ---------- */
const TIP = document.createElement("div"); TIP.className = "tip"; document.body.appendChild(TIP);
document.addEventListener("mousemove", e => {
  const t = e.target.closest("[data-tip]");
  if (!t) { TIP.style.opacity = 0; return; }
  TIP.innerHTML = t.dataset.tip; TIP.style.opacity = 1;
  TIP.style.left = Math.min(e.clientX + 14, innerWidth - TIP.offsetWidth - 10) + "px"; TIP.style.top = (e.clientY + 14) + "px";
});

/* ---------- dados (linha de segurança aplicada aqui) ---------- */
function visiveis(db) { return db.demandas.filter(d => podeVerNaAnalise(USER, d)); }
function base() {
  const db = carregarDB(), agora = new Date();
  const ini = F.periodo === "tudo" ? null : new Date(agora - (+F.periodo) * 864e5);
  let todas = visiveis(db);
  if (F.destino) todas = todas.filter(d => destinoDe(d) === F.destino);
  if (F.operadora) todas = todas.filter(d => d.operadora === F.operadora);
  if (F.responsavel) todas = todas.filter(d => (d.responsavel || "Sem responsável") === F.responsavel);
  const noPeriodo = ini ? todas.filter(d => paraData(d.dt_abertura) >= ini) : todas;
  const concluidasPeriodo = todas.filter(d => d.status === "Concluído" && d.dt_conclusao && (!ini || paraData(d.dt_conclusao) >= ini));
  const ids = new Set(todas.map(d => d.id));
  const hist = db.historico.filter(h => ids.has(h.demanda_id));
  return {db, todas, D: noPeriodo, C: concluidasPeriodo, hist, ini, agora: agoraStr(), backlog: todas.filter(d => !FINAIS.includes(d.status))};
}

/* tempo médio em cada status (horas) a partir do histórico */
function tempoPorStatus(hist, agora) {
  const porDem = {}; hist.forEach(h => (porDem[h.demanda_id] = porDem[h.demanda_id] || []).push(h));
  const acc = {};
  Object.values(porDem).forEach(ev => {
    ev.sort((a, b) => a.dt_evento < b.dt_evento ? -1 : 1);
    ev.forEach((h, i) => {
      if (FINAIS.includes(h.status_para)) return;
      const fim = ev[i + 1] ? ev[i + 1].dt_evento : agora;
      (acc[h.status_para] = acc[h.status_para] || []).push(horas(h.dt_evento, fim));
    });
  });
  return OPCOES.status.filter(s => !FINAIS.includes(s)).map(s => [s, media(acc[s] || []), (acc[s] || []).length]);
}
/* abertura → saída da triagem (1ª resposta) */
function primeiraResposta(D, hist) {
  return D.map(d => { const h = hist.filter(x => x.demanda_id === d.id && x.status_de === "Em Triagem").sort((a, b) => a.dt_evento < b.dt_evento ? -1 : 1)[0];
    return h ? horas(d.dt_abertura, h.dt_evento) : null; }).filter(x => x != null);
}
/* agrupamento temporal */
function buckets(ini, fim) {
  const totalDias = (fim - ini) / 864e5, modo = totalDias <= 35 ? "dia" : totalDias <= 150 ? "semana" : "mes", out = [];
  let c = new Date(ini); c.setHours(0, 0, 0, 0);
  if (modo === "semana") c.setDate(c.getDate() - c.getDay());
  if (modo === "mes") c.setDate(1);
  while (c <= fim) {
    const n = new Date(c);
    if (modo === "dia") n.setDate(n.getDate() + 1); else if (modo === "semana") n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1);
    out.push({ini: new Date(c), fim: n, rot: modo === "mes" ? c.toLocaleDateString("pt-BR", {month: "short", year: "2-digit"}) : c.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})});
    c = n;
  }
  return {modo, out};
}

/* ---------- componentes SVG ---------- */
function sparkline(vals, cor) {
  if (vals.length < 2) return "<svg></svg>";
  const W = 200, H = 34, mx = Math.max(...vals, 1), pts = vals.map((v, i) => [i * W / (vals.length - 1), H - 3 - v / mx * (H - 6)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  const id = "g" + Math.random().toString(36).slice(2);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".35"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
    <path d="${path}L${W},${H}L0,${H}Z" fill="url(#${id})"/><path d="${path}" fill="none" stroke="${cor}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function graficoFluxo(B, series) {
  const W = 820, H = 270, L = 38, R = 14, T = 16, Bt = 34, iw = W - L - R, ih = H - T - Bt, n = B.out.length;
  const mx = Math.max(1, ...series.flatMap(s => s.vals)), passo = Math.ceil(mx / 4), top = passo * 4;
  const x = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1)), y = v => T + ih - v / top * ih;
  let g = "";
  for (let k = 0; k <= 4; k++) { const yy = y(k * passo); g += `<line class="gr" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end">${k * passo}</text>`; }
  const salto = Math.ceil(n / 12);
  B.out.forEach((b, i) => { if (i % salto === 0) g += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${b.rot}</text>`; });
  series.forEach((s, si) => {
    const pts = s.vals.map((v, i) => [x(i), y(v)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
    const id = "fl" + si;
    if (s.area) g += `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.cor}" stop-opacity=".38"/><stop offset="1" stop-color="${s.cor}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#${id})"/>`;
    g += `<path d="${d}" fill="none" stroke="${s.cor}" stroke-width="${s.area ? 3 : 2.2}" ${s.tracejado ? 'stroke-dasharray="6 5"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  B.out.forEach((b, i) => {
    const tip = `<b>${b.rot}</b><br>` + series.map(s => `<span style="color:${s.cor}">●</span> ${s.nome}: <b>${s.vals[i]}</b>`).join("<br>");
    g += `<rect x="${x(i) - iw / n / 2}" y="${T}" width="${Math.max(iw / n, 4)}" height="${ih}" fill="transparent" data-tip='${tip}'/>`;
    series.forEach(s => { if (n <= 40) g += `<circle cx="${x(i)}" cy="${y(s.vals[i])}" r="3" fill="${s.cor}" pointer-events="none"/>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="leg">${series.map(s => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join("")}</div>`;
}
function donut(itens, centro, sub, mapa) {
  const C = mapa ? itens.map(i => mapa[i[0]] || "#999") : cores(), tot = itens.reduce((s, x) => s + x[1], 0) || 1, R = 70, r = 48, cx = 85, cy = 85;
  let a0 = -Math.PI / 2, g = "";
  itens.forEach(([nome, v], i) => {
    const a1 = a0 + v / tot * Math.PI * 2 - (itens.length > 1 ? 0.02 : 0), large = a1 - a0 > Math.PI ? 1 : 0;
    const P = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const [x0, y0] = P(R, a0), [x1, y1] = P(R, a1), [x2, y2] = P(r, a1), [x3, y3] = P(r, a0);
    const d = itens.length === 1 ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`
      : `M${x0},${y0}A${R},${R} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${large} 0 ${x3},${y3}Z`;
    g += `<path d="${d}" fill="${C[i % C.length]}" fill-rule="evenodd" data-tip="<b>${esc(nome)}</b>: ${v} (${Math.round(v / tot * 100)}%)" style="cursor:pointer"/>`;
    a0 = a1 + (itens.length > 1 ? 0.02 : 0);
  });
  g += `<text x="${cx}" y="${cy + 2}" text-anchor="middle" class="lbl" style="font-size:24px">${centro}</text><text x="${cx}" y="${cy + 20}" text-anchor="middle">${sub}</text>`;
  return `<div class="donut-wrap"><svg viewBox="0 0 170 170">${g}</svg><div class="leg">${itens.map(([n, v], i) =>
    `<span><i style="background:${C[i % C.length]}"></i>${esc(n)}<b>${v}</b> <small>(${Math.round(v / tot * 100)}%)</small></span>`).join("")}</div></div>`;
}
function barrasH(itens, cor, sufixo = "", fmtV = v => v) {
  if (!itens.length) return `<div class="vazio-an">Sem dados no período</div>`;
  const mx = Math.max(...itens.map(x => x[1]), 1), C = cores();
  return itens.map(([n, v, extra], i) => `<div class="hbar" data-tip="<b>${esc(n)}</b>: ${fmtV(v)}${sufixo}${extra ? "<br>" + extra : ""}">
    <span class="n" title="${esc(n)}">${esc(n)}</span><span class="t"><i style="width:${v / mx * 100}%;background:${cor || C[i % C.length]};animation-delay:${i * 60}ms"></i></span><span class="qt">${fmtV(v)}</span></div>`).join("");
}
function colunas(itens, corFn, sufixo = "") {
  if (!itens.length || itens.every(x => !x[1])) return `<div class="vazio-an">Sem dados no período</div>`;
  const W = 520, H = 230, L = 10, T = 22, Bt = 46, iw = W - L * 2, ih = H - T - Bt, n = itens.length, bw = Math.min(56, iw / n * .62);
  const mx = Math.max(...itens.map(x => x[1] || 0), 1);
  let g = `<line class="gr" x1="${L}" x2="${W - L}" y1="${T + ih}" y2="${T + ih}"/>`;
  itens.forEach(([nome, v], i) => {
    const cx = L + iw / n * (i + .5), h = (v || 0) / mx * ih, yy = T + ih - h, cor = corFn(i, v);
    g += `<rect x="${cx - bw / 2}" y="${yy}" width="${bw}" height="${h}" rx="8" fill="${cor}" data-tip="<b>${esc(nome)}</b>: ${n1(v || 0)}${sufixo}"><animate attributeName="height" from="0" to="${h}" dur=".7s"/><animate attributeName="y" from="${T + ih}" to="${yy}" dur=".7s"/></rect>
      <text x="${cx}" y="${yy - 6}" text-anchor="middle" class="lbl">${isFinite(v) ? n1(v) : "—"}</text>`;
    const max = Math.max(6, Math.floor(iw / n / 6.2)), ps = nome.split(/\s+/), l1 = [], l2 = [];
    ps.forEach(w => ((l1.join(" ") + " " + w).trim().length <= max && !l2.length ? l1 : l2).push(w));
    const cut = t => t.length > max ? t.slice(0, max - 1) + "…" : t;
    g += `<text x="${cx}" y="${H - 28}" text-anchor="middle">${esc(cut(l1.join(" ") || nome))}</text>${l2.length ? `<text x="${cx}" y="${H - 14}" text-anchor="middle">${esc(cut(l2.join(" ")))}</text>` : ""}`;
  });
  return `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
/* barras agrupadas: TMA previsto × realizado */
function colunasDuplas(itens) {
  if (!itens.length) return `<div class="vazio-an">Sem demandas concluídas com previsão de entrega no período</div>`;
  const W = 620, H = 250, L = 10, T = 24, Bt = 46, iw = W - L * 2, ih = H - T - Bt, n = itens.length, gw = iw / n, bw = Math.min(30, gw * .32);
  const mx = Math.max(1, ...itens.flatMap(x => [x[1], x[2]]));
  let g = `<line class="gr" x1="${L}" x2="${W - L}" y1="${T + ih}" y2="${T + ih}"/>`;
  itens.forEach(([nome, prev, real, qtd], i) => {
    const cx = L + gw * (i + .5);
    [[prev, css("--lav"), "Previsto", -1], [real, real > prev ? css("--erro") : css("--teal"), "Realizado", 1]].forEach(([v, cor, rot, lado]) => {
      const h = v / mx * ih, x = cx + (lado < 0 ? -bw - 2 : 2), y = T + ih - h;
      g += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${cor}" data-tip="<b>${esc(nome)}</b><br>TMA ${rot.toLowerCase()}: ${n1(v)} d<br>${qtd} demanda(s)"><animate attributeName="height" from="0" to="${h}" dur=".7s"/><animate attributeName="y" from="${T + ih}" to="${y}" dur=".7s"/></rect>
        <text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" class="lbl">${n1(v)}</text>`;
    });
    const max = Math.max(6, Math.floor(gw / 6.2)), t = nome.length > max ? nome.slice(0, max - 1) + "…" : nome;
    g += `<text x="${cx}" y="${H - 26}" text-anchor="middle">${esc(t)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="leg"><span><i style="background:${css("--lav")}"></i>TMA previsto</span><span><i style="background:${css("--teal")}"></i>Realizado dentro do previsto</span><span><i style="background:${css("--erro")}"></i>Realizado acima do previsto</span></div>`;
}

/* ---------- render ---------- */
function render() {
  const {db, todas, D, C, hist, ini, agora, backlog} = base(), CR = cores();
  if (!INDIVIDUAL) {
    const respOpts = [...new Set(visiveis(db).map(d => d.responsavel || "Sem responsável"))].sort();
    $("#fResp").innerHTML = `<option value="">Todos os responsáveis</option>` + respOpts.map(r => `<option ${r === F.responsavel ? "selected" : ""}>${esc(r)}</option>`).join("");
  }
  $("#vazio").classList.toggle("hidden", INDIVIDUAL || db.demandas.length >= 5);
  $("#btnRemoverEx").classList.toggle("hidden", INDIVIDUAL || !db.demandas.some(d => d.exemplo));
  if (!todas.length) {
    $("#painel").innerHTML = `<div class="pn c12 vazio-an">${INDIVIDUAL ? "Nenhuma demanda atribuída a você com os filtros selecionados." : "Nenhuma demanda encontrada com os filtros selecionados."}</div>`;
    $("#kpisAn").innerHTML = ""; $("#insights").innerHTML = ""; return;
  }

  /* séries temporais */
  const inicio = ini || paraData(todas.reduce((m, d) => d.dt_abertura < m ? d.dt_abertura : m, todas[0].dt_abertura));
  const B = buckets(inicio, new Date());
  const em = (s, b) => s && paraData(s) >= b.ini && paraData(s) < b.fim;
  const abertasS = B.out.map(b => todas.filter(d => em(d.dt_abertura, b)).length);
  const conclS = B.out.map(b => todas.filter(d => d.status === "Concluído" && em(d.dt_conclusao, b)).length);
  const backlogS = B.out.map(b => todas.filter(d => paraData(d.dt_abertura) < b.fim && !(d.dt_conclusao && paraData(d.dt_conclusao) < b.fim)).length);

  /* KPIs */
  const leads = C.map(d => dias(d.dt_abertura, d.dt_conclusao));
  const comPrazo = C.filter(d => d.prazo), noPrazo = comPrazo.filter(d => d.dt_conclusao.slice(0, 10) <= d.prazo);
  const pctPrazo = comPrazo.length ? noPrazo.length / comPrazo.length * 100 : NaN;
  const pr = primeiraResposta(D, hist);
  const atrasadas = backlog.filter(d => d.prazo && d.prazo < agora.slice(0, 10)).length;
  const vazao = D.length ? C.length / D.length * 100 : NaN;
  const kp = [
    [INDIVIDUAL ? "Atribuídas a mim" : "Demandas abertas", D.length, "", `no período · ${n1(D.length / Math.max(B.out.length, 1))}/${B.modo}`, css("--primaria"), abertasS],
    ["Concluídas", C.length, "", `taxa de vazão ${isFinite(vazao) ? Math.round(vazao) + "%" : "—"}`, css("--teal"), conclS],
    [INDIVIDUAL ? "Meu backlog" : "Backlog atual", backlog.length, "", atrasadas ? `⚠ ${atrasadas} com prazo vencido` : "nenhuma com prazo vencido", css("--ouro"), backlogS],
    ["Lead time médio", isFinite(media(leads)) ? n1(media(leads)) : "—", "dias", `mediana ${isFinite(mediana(leads)) ? n1(mediana(leads)) + " d" : "—"}`, css("--lav"), null],
    ["Entregas no prazo", isFinite(pctPrazo) ? Math.round(pctPrazo) : "—", isFinite(pctPrazo) ? "%" : "", `${noPrazo.length} de ${comPrazo.length} com prazo`, "#7BD88F", null],
    ["1ª resposta (triagem)", isFinite(media(pr)) ? fmtTempo(media(pr)).split(" ")[0] : "—", isFinite(media(pr)) ? fmtTempo(media(pr)).split(" ")[1] : "", "tempo até sair da triagem", "#E86FA8", null]];
  $("#kpisAn").innerHTML = kp.map(([l, v, u, d, cor, s], i) => `<div class="ak" style="animation:surgir .4s ${i * 60}ms both">
    <div class="l"><i style="background:${cor}"></i>${l}</div><div class="v">${v}<small>${u}</small></div><div class="d">${d}</div>
    ${s ? sparkline(s, cor) : `<svg viewBox="0 0 200 34" preserveAspectRatio="none"><rect x="0" y="26" width="200" height="6" rx="3" fill="var(--sup-2)"/><rect x="0" y="26" width="${Math.min(100, isFinite(+v) ? (u === "%" ? +v : Math.min(100, 100 - (+String(v).replace(",", ".") * 4))) : 0) * 2}" height="6" rx="3" fill="${cor}"/></svg>`}</div>`).join("");

  /* agregações */
  const porSolic = contar(D, d => d.solicitante_nome).slice(0, 8);
  const porTipo = contar(D, d => d.tipo);
  const porOper = contar(D, op);
  const porArea = contar(D.filter(d => d.area), d => d.area);
  const porNivel = contar(D.filter(d => d.nivel), d => d.nivel);
  const porStatus = OPCOES.status.map(s => [s, todas.filter(d => d.status === s).length]).filter(x => x[1]);
  const porPri = OPCOES.prioridades.map(p => [p, D.filter(d => d.prioridade === p).length]);
  const leadTipo = [...new Set(C.map(d => d.tipo))].map(t => [t, media(C.filter(d => d.tipo === t).map(d => dias(d.dt_abertura, d.dt_conclusao)))]).filter(x => isFinite(x[1])).sort((a, b) => b[1] - a[1]);
  const leadComp = OPCOES.complexidades.map(c => [c, media(C.filter(d => d.complexidade === c).map(d => dias(d.dt_abertura, d.dt_conclusao)))]);
  const tStatus = tempoPorStatus(hist, agora);
  const faixas = [["0–2 dias", 0, 2], ["3–5 dias", 2, 5], ["6–10 dias", 5, 10], ["11–20 dias", 10, 20], ["+20 dias", 20, 1e9]];
  const aging = faixas.map(([n, a, b]) => [n, backlog.filter(d => { const x = dias(d.dt_abertura, agora); return x >= a && x < b; }).length]);
  const corAging = [css("--teal"), css("--teal"), css("--ouro"), "#FF9F6B", css("--erro")];

  /* produtividade por responsável */
  const resps = [...new Set(todas.map(d => d.responsavel).filter(Boolean))];
  const prod = resps.map(r => {
    const conc = C.filter(d => d.responsavel === r), and = backlog.filter(d => d.responsavel === r);
    const lt = media(conc.map(d => dias(d.dt_abertura, d.dt_conclusao)));
    const cp = conc.filter(d => d.prazo), np = cp.filter(d => d.dt_conclusao.slice(0, 10) <= d.prazo).length;
    const complexas = conc.filter(d => d.complexidade === "Alta").length;
    return {r, conc: conc.length, and: and.length, lt, prazo: cp.length ? np / cp.length * 100 : NaN, complexas};
  }).sort((a, b) => b.conc - a.conc || b.and - a.and);
  const maxCarga = Math.max(1, ...prod.map(p => p.conc + p.and));
  const semResp = backlog.filter(d => !d.responsavel).length;

  /* heatmap */
  const heat = Array.from({length: 7}, () => Array(24).fill(0));
  D.forEach(d => { const t = paraData(d.dt_abertura); heat[t.getDay()][t.getHours()]++; });
  const hmx = Math.max(1, ...heat.flat());
  let pico = [0, 0, 0]; heat.forEach((l, di) => l.forEach((v, h) => { if (v > pico[2]) pico = [di, h, v]; }));

  /* insights automáticos */
  const ins = [];
  if (INDIVIDUAL) ins.push(`🔒 Visão individual: <b>${esc(USER.nome)}</b> · ${esc(DESTINOS[USER.escopo].rotulo)}`);
  if (porSolic[0]) ins.push(`👤 Maior demandante: <b>${esc(porSolic[0][0])}</b> (${porSolic[0][1]})`);
  if (porTipo[0]) ins.push(`🏷️ Tipo mais pedido: <b>${esc(porTipo[0][0])}</b>`);
  if (leadTipo[0]) ins.push(`🐢 Mais demorado: <b>${esc(leadTipo[0][0])}</b> (${n1(leadTipo[0][1])} d)`);
  const gargalo = tStatus.filter(x => isFinite(x[1])).sort((a, b) => b[1] - a[1])[0];
  if (gargalo) ins.push(`⏳ Gargalo: <b>${gargalo[0]}</b> (${fmtTempo(gargalo[1])} em média)`);
  if (pico[2]) ins.push(`🔥 Pico de abertura: <b>${DIAS[pico[0]]} às ${pico[1]}h</b>`);
  if (semResp && !INDIVIDUAL) ins.push(`🙋 <b>${semResp}</b> no backlog sem responsável`);
  $("#insights").innerHTML = ins.map(x => `<span>${x}</span>`).join("");

  const chip = (v, bom, ruim) => !isFinite(v) ? "—" : `<span class="chip" style="background:${v >= bom ? css("--teal") : v >= ruim ? css("--ouro") : css("--erro")};color:#0F0D2E">${Math.round(v)}%</span>`;

  /* TMA previsto × realizado (dias corridos, da data de chegada até a entrega) */
  const comTMA = C.filter(d => tmaPrevisto(d) != null && tmaRealizado(d) != null);
  const prevM = media(comTMA.map(tmaPrevisto)), realM = media(comTMA.map(tmaRealizado)), desvio = realM - prevM;
  const dentro = comTMA.filter(d => tmaRealizado(d) <= tmaPrevisto(d)).length;
  const pctDentro = comTMA.length ? dentro / comTMA.length * 100 : NaN;
  const emRisco = backlog.filter(d => d.prazo && tmaDecorrido(d) > tmaPrevisto(d)).length;
  const grupoTMA = fn => { const m = {}; comTMA.forEach(d => { const k = fn(d) || "Sem responsável"; (m[k] = m[k] || []).push(d); });
    return Object.entries(m).map(([k, l]) => [k, media(l.map(tmaPrevisto)), media(l.map(tmaRealizado)), l.length,
      l.filter(d => tmaRealizado(d) <= tmaPrevisto(d)).length / l.length * 100]).sort((a, b) => b[3] - a[3]); };
  const tmaTipo = grupoTMA(d => d.tipo_outro || d.tipo).slice(0, 8), tmaResp = grupoTMA(d => d.responsavel);
  const corDesv = v => !isFinite(v) ? "var(--texto-2)" : v > 0 ? css("--erro") : css("--teal");
  const sinal = v => !isFinite(v) ? "—" : (v > 0 ? "+" : "") + n1(v) + " d";
  const painelTMA = `<div class="pn c12"><h3>TMA previsto × TMA realizado${INDIVIDUAL ? " · minhas entregas" : ""}</h3>
    <div class="sub">Dias corridos entre a <b>data de chegada</b> da demanda e a <b>previsão de entrega</b> (previsto) ou a <b>conclusão</b> (realizado) · ${comTMA.length} demanda(s) concluída(s) com previsão no período</div>
    <div class="tma-kpis">
      <div class="tma-k" style="border-left-color:${css("--lav")}"><div class="l">TMA previsto</div><div class="v">${n1(prevM)}<small>dias</small></div><div class="d">média das previsões</div></div>
      <div class="tma-k" style="border-left-color:${css("--teal")}"><div class="l">TMA realizado</div><div class="v">${n1(realM)}<small>dias</small></div><div class="d">média das entregas</div></div>
      <div class="tma-k" style="border-left-color:${corDesv(desvio)}"><div class="l">Desvio</div><div class="v" style="color:${corDesv(desvio)}">${sinal(desvio)}</div><div class="d">${!isFinite(desvio) ? "—" : desvio > 0 ? "entregando acima do previsto" : "entregando dentro/antes do previsto"}</div></div>
      <div class="tma-k" style="border-left-color:#7BD88F"><div class="l">Dentro do TMA previsto</div><div class="v">${isFinite(pctDentro) ? Math.round(pctDentro) : "—"}<small>%</small></div><div class="d">${dentro} de ${comTMA.length}</div></div>
      <div class="tma-k" style="border-left-color:${css("--ouro")}"><div class="l">Backlog estourando o TMA</div><div class="v">${emRisco}</div><div class="d">em aberto já acima do previsto</div></div>
    </div>
    <div class="tma-grid">
      <div><div class="sub" style="margin-top:0"><b>Por tipo de demanda</b></div>${colunasDuplas(tmaTipo)}</div>
      <div><div class="sub" style="margin-top:0"><b>Por responsável</b></div>
        ${tmaResp.length ? `<table class="tab-an"><thead><tr><th>Responsável</th><th>Qtd</th><th>Previsto</th><th>Realizado</th><th>Desvio</th><th>Dentro</th></tr></thead><tbody>
        ${tmaResp.map(([r, p, re, q, pc], i) => `<tr><td><div class="pessoa"><span class="avatar" style="background:${CR[i % CR.length]};color:#0F0D2E">${iniciais(r)}</span><span class="quebra">${esc(r)}</span></div></td>
          <td>${q}</td><td>${n1(p)} d</td><td><b>${n1(re)} d</b></td><td style="color:${corDesv(re - p)};font-weight:700">${sinal(re - p)}</td><td>${chip(pc, 85, 60)}</td></tr>`).join("")}</tbody></table>`
        : `<div class="vazio-an">Preencha a data de chegada e a previsão de entrega nas demandas para ver esta análise.</div>`}</div>
    </div></div>`;

  $("#painel").innerHTML = painelTMA + `
    <div class="pn c8"><h3>Fluxo de demandas</h3><div class="sub">Abertas × concluídas por ${B.modo} e evolução do backlog</div>
      ${graficoFluxo(B, [{nome: "Abertas", vals: abertasS, cor: css("--primaria"), area: true}, {nome: "Concluídas", vals: conclS, cor: css("--teal"), area: true}, {nome: "Backlog", vals: backlogS, cor: css("--ouro"), tracejado: true}])}</div>
    <div class="pn c4"><h3>Status atual</h3><div class="sub">Distribuição das demandas ${INDIVIDUAL ? "atribuídas a você" : "visíveis"}</div>${donut(porStatus, todas.length, "demandas", {"Em Triagem": css("--lav"), "Triagem Concluída": "#9B8CFF", "Aguardando Solicitante": css("--ouro"), "Em Andamento": css("--primaria"), "Concluído": css("--teal"), "Cancelado": "#8A87A8"})}</div>

    <div class="pn c4"><h3>Quem mais abre demandas</h3><div class="sub">Top 8 solicitantes no período</div>${barrasH(porSolic, css("--primaria"))}</div>
    <div class="pn c4"><h3>Demandas por tipo</h3><div class="sub">Volume no período</div>${barrasH(porTipo)}</div>
    <div class="pn c4"><h3>${F.destino === "Facilities" ? "Por setor" : "Por operadora"}</h3><div class="sub">Origem das solicitações</div>${donut(porOper, D.length, "no período")}</div>

    <div class="pn c6"><h3>Lead time por tipo</h3><div class="sub">Dias médios da abertura à conclusão</div>${colunas(leadTipo, (i) => [css("--primaria"), css("--teal"), css("--ouro"), css("--lav")][i % 4], " dias")}</div>
    <div class="pn c6"><h3>Onde a demanda passa o tempo</h3><div class="sub">Tempo médio em cada etapa (gargalos do fluxo)</div>
      <div class="funil">${(() => { const mx = Math.max(1, ...tStatus.map(x => isFinite(x[1]) ? x[1] : 0)); const cs = [css("--lav"), css("--primaria"), css("--ouro"), css("--teal")];
        return tStatus.map(([s, h, q], i) => `<div class="et" data-tip="<b>${s}</b><br>${q} passagem(ns) · média ${fmtTempo(h)}"><span>${s}</span>
          <div class="bar" style="width:${isFinite(h) ? Math.max(8, h / mx * 100) : 8}%;background:${cs[i]};color:${i === 0 || i === 2 ? "#0F0D2E" : "#fff"};animation-delay:${i * 90}ms">${isFinite(h) ? fmtTempo(h) : "—"}</div><span style="text-align:right;color:var(--texto-2)">${q}×</span></div>`).join(""); })()}</div>
      <div class="sub" style="margin-top:10px">Lead time por complexidade: ${leadComp.map(([c, v]) => `<b>${c}</b> ${isFinite(v) ? n1(v) + " d" : "—"}`).join(" · ")}</div></div>

    <div class="pn c7"><h3>${INDIVIDUAL ? "Minha produtividade" : "Produtividade por responsável"}</h3><div class="sub">Entregas no período, carga atual e eficiência</div>
      ${prod.length ? `<table class="tab-an"><thead><tr><th>Responsável</th><th>Concluídas</th><th>Em aberto</th><th>Carga</th><th>Lead time</th><th>No prazo</th><th>Alta complex.</th></tr></thead><tbody>
      ${prod.map((p, i) => `<tr><td><div class="pessoa"><span class="avatar" style="background:${CR[i % CR.length]};color:#0F0D2E">${iniciais(p.r)}</span><span class="quebra">${esc(p.r)}</span></div></td>
        <td><b>${p.conc}</b></td><td>${p.and}</td>
        <td><div class="mini" data-tip="${p.conc} concluídas + ${p.and} em aberto"><i style="width:${(p.conc + p.and) / maxCarga * 100}%;background:linear-gradient(90deg,${css("--teal")} ${p.conc / Math.max(1, p.conc + p.and) * 100}%,${css("--ouro")} 0)"></i></div></td>
        <td>${isFinite(p.lt) ? n1(p.lt) + " d" : "—"}</td><td>${chip(p.prazo, 85, 60)}</td><td>${p.complexas}</td></tr>`).join("")}</tbody></table>
        ${semResp && !INDIVIDUAL ? `<div class="sub" style="margin-top:10px">⚠ ${semResp} demanda(s) do backlog ainda sem responsável.</div>` : ""}` : `<div class="vazio-an">Defina responsáveis nas demandas para ver esta análise.</div>`}</div>
    <div class="pn c5"><h3>Envelhecimento do backlog</h3><div class="sub">Há quanto tempo as demandas abertas estão esperando</div>${colunas(aging, i => corAging[i])}</div>

    <div class="pn c8"><h3>Quando as demandas chegam</h3><div class="sub">Mapa de calor de abertura por dia da semana e hora</div>
      <div class="heat"><span></span>${Array.from({length: 24}, (_, h) => `<span class="hr">${h % 3 === 0 ? h : ""}</span>`).join("")}
      ${heat.map((l, di) => `<span class="lb">${DIAS[di]}</span>` + l.map((v, h) => `<div class="h" data-tip="<b>${DIAS[di]} ${h}h</b>: ${v} demanda(s)" style="${v ? `background:color-mix(in srgb,${css("--primaria")} ${15 + v / hmx * 85}%,transparent)` : ""}"></div>`).join("")).join("")}</div></div>
    <div class="pn c4"><h3>Perfil do solicitante</h3><div class="sub">Área Amil e nível (Equipe Dados)</div>
      ${porArea.length ? barrasH(porArea, css("--teal")) : ""}${porNivel.length ? `<div style="margin-top:12px"></div>` + barrasH(porNivel, css("--ouro")) : ""}${!porArea.length && !porNivel.length ? `<div class="vazio-an">Sem dados</div>` : ""}
      <div class="sub" style="margin-top:14px">Prioridade: ${porPri.map(([p, v]) => `<b>${p}</b> ${v}`).join(" · ")}</div></div>`;
}

/* ---------- dados de exemplo (somente gestão / nível 3) ---------- */
function gerarExemplo() {
  if (INDIVIDUAL) return;
  const db = carregarDB(), agora = new Date(), R = a => a[Math.floor(Math.random() * a.length)];
  const pessoas = [["Lucas Belgoni", "lucas.belgoni"], ["Matheus Padilha", "padilh.matheus"], ["Rodrigo Oliveira", "oliveira.rodrigo"], ["Kauan Felipe", "kauan.felipe"],
    ["Michele Torres", "michele.torres"], ["Giane Nascimento", "giane.nascimento"], ["Felipe Couto", "felipe.couto"], ["Carlos Geraldelli", "carlos.geraldelli"]];
  const resumos = ["Dashboard de NPS por ilha", "Extração de ligações do mês", "Ajuste no relatório de ABS", "Automação do envio diário", "Estudo de RCA da Ouvidoria",
    "Base de NIPs abertas", "Indicador de aderência por site", "Painel de reclamações", "Análise de rechamadas", "Projeção de volume"];
  const ano = agora.getFullYear();
  for (let i = 0; i < 140; i++) {
    const ab = new Date(agora - Math.pow(Math.random(), 1.25) * 120 * 864e5);
    ab.setHours(8 + Math.floor(Math.random() * 10 * Math.random() + Math.random() * 3), Math.floor(Math.random() * 60));
    if ([0, 6].includes(ab.getDay()) && Math.random() < .8) ab.setDate(ab.getDate() + 2);
    if (ab > agora) ab.setTime(agora - 36e5);
    const fac = Math.random() < .25;
    const [nome, mail] = R(pessoas), oper = fac ? null : Math.random() < .55 ? "Amil" : Math.random() < .5 ? "Equipe Dados" : R(["Total Care", "SOBAM", "Ana Costa", "Santa Helena"]);
    const tipo = fac ? R(OPCOES.solicitacoes_fac) : R(["Análise", "Análise", "Extração de base", "Extração de base", "Criação de Dashboard", "Ajustes", "Ajustes", "Automação", "Consultoria", "Robbyson", "Estudos / Projetos"]);
    const comp = fac ? R(["Baixa", "Baixa", "Média"]) : {"Criação de Dashboard": "Alta", "Estudos / Projetos": "Alta", "Automação": R(["Média", "Alta"]), "Extração de base": "Baixa"}[tipo] || R(["Baixa", "Média"]);
    const fator = {Baixa: 1.2, Média: 3.5, Alta: 8}[comp];
    db.seq++;
    const pref = fac ? "FAC" : "MIS", nSeq = db.demandas.filter(x => (x.protocolo || "").startsWith(`${pref}-${ano}`)).length + 1;
    const sist = R(["Robbyson", "Genesys", "CRM", "Totvs"]), colab = R(["Ana Paula Lima", "Bruno Souza", "Carla Mendes", "Diego Ramos"]);
    const d = {id: db.seq, protocolo: `${pref}-${ano}-${String(nSeq).padStart(4, "0")}`, exemplo: true, destino: fac ? "Facilities" : "MIS", setor: fac ? R(OPCOES.setores) : null,
      fac: fac ? {nome: colab, cpf: "000.000.000-00", ilha: R(["PME", "Ouvidoria", "Retenção"]), sistema: sist, matricula: String(Math.floor(100000 + Math.random() * 900000)),
        email: colab.toLowerCase().replace(/ /g, ".") + "@amil.com.br", login: "u" + Math.floor(1e7 + Math.random() * 9e7), a_partir: dataStr(ab).slice(0, 10), motivo: "Exemplo"} : null,
      dt_chegada: dataStr(new Date(ab.getTime() + (Math.random() < .3 ? Math.floor(Math.random() * 3) * 864e5 : 0))).slice(0, 10),
      operadora: oper, operadora_outro: null, area: oper === "Amil" ? R(OPCOES.areas) : null, nivel: oper === "Equipe Dados" ? R(OPCOES.niveis) : null,
      tipo, tipo_outro: null, resumo: fac ? `${tipo} - ${colab} (${sist})` : R(resumos), descricao: "Demanda de exemplo gerada para visualizar o painel de análises.",
      status: "Em Triagem", prioridade: R(["Baixa", "Média", "Média", "Média", "Alta", "Urgente"]), complexidade: null, responsavel: null, responsavel_login: null, prazo: null,
      solicitante_matricula: mail, solicitante_nome: nome, solicitante_email: mail + "@amil.com.br", anexos: [],
      dt_abertura: dataStr(ab), dt_atualizacao: dataStr(ab), dt_conclusao: null};
    const ev = [{status_de: null, status_para: "Em Triagem", t: ab}];
    let t = new Date(ab.getTime() + (2 + Math.random() * 30) * 36e5);
    const passo = (s, h) => { if (t > agora) return false; ev.push({status_de: ev[ev.length - 1].status_para, status_para: s, t: new Date(t)}); t = new Date(t.getTime() + h * 36e5); return true; };
    if (Math.random() < .04) passo("Cancelado", 0);
    else if (passo("Triagem Concluída", (4 + Math.random() * 20)) && passo("Em Andamento", fator * 24 * (0.4 + Math.random()))) {
      if (Math.random() < .35) { passo("Aguardando Solicitante", 6 + Math.random() * 60); passo("Em Andamento", fator * 12 * Math.random()); }
      passo("Concluído", 0);
    }
    const ult = ev[ev.length - 1];
    d.status = ult.status_para; d.complexidade = d.status === "Em Triagem" ? null : comp;
    if (!(d.status === "Em Triagem" && Math.random() < .7)) {
      const l = R(fac ? NIVEL2_FACILITIES : NIVEL2_MIS);   /* atribui a um login real da equipe */
      d.responsavel_login = l; d.responsavel = nomeDoLogin(l);
    }
    d.prazo = d.complexidade ? dataStr(new Date(ab.getTime() + fator * (1.2 + Math.random()) * 864e5)).slice(0, 10) : null;
    if (FINAIS.includes(d.status)) d.dt_conclusao = dataStr(ult.t);
    d.dt_atualizacao = dataStr(ult.t);
    db.demandas.push(d);
    ev.forEach(e => db.historico.push({demanda_id: d.id, status_de: e.status_de, status_para: e.status_para, usuario: "exemplo", dt_evento: dataStr(e.t)}));
  }
  gravarDB(db); toast("140 demandas de exemplo geradas."); render();
}
function removerExemplo() {
  if (INDIVIDUAL) return;
  const db = carregarDB(), ids = new Set(db.demandas.filter(d => d.exemplo).map(d => d.id));
  db.demandas = db.demandas.filter(d => !ids.has(d.id)); db.historico = db.historico.filter(h => !ids.has(h.demanda_id));
  db.comentarios = db.comentarios.filter(c => !ids.has(c.demanda_id)); db.emails = db.emails.filter(m => !ids.has(m.demanda_id));
  gravarDB(db); toast("Dados de exemplo removidos."); render();
}

/* ---------- controles ---------- */
if (USER) {
  if (INDIVIDUAL) {
    /* nível 2: escopo travado, sem filtro de responsável (só vê o que é dele) */
    $("#fDestAn").innerHTML = `<option value="${USER.escopo}">${esc(DESTINOS[USER.escopo].rotulo)}</option>`;
    $("#fDestAn").disabled = true;
    $("#fResp").remove();
    if (USER.escopo === "Facilities") $("#fOperAn").remove();
    document.querySelector(".an-hero h1").innerHTML = `Meu painel de <b>Produtividade</b>`;
    document.querySelector(".an-hero p").textContent = `Demandas de ${DESTINOS[USER.escopo].rotulo} atribuídas a você`;
  } else {
    $("#fDestAn").innerHTML = `<option value="">MIS e Facilities</option>` + Object.keys(DESTINOS).map(k => `<option value="${k}">${esc(DESTINOS[k].rotulo)}</option>`).join("");
    $("#fDestAn").onchange = e => { F.destino = e.target.value; render(); };
    $("#fResp").onchange = e => { F.responsavel = e.target.value; render(); };
  }
  if ($("#fOperAn")) {
    $("#fOperAn").innerHTML = `<option value="">Todas as operadoras</option>` + OPCOES.operadoras.map(o => `<option>${esc(o)}</option>`).join("");
    $("#fOperAn").onchange = e => { F.operadora = e.target.value; render(); };
  }
  document.querySelectorAll("#segPeriodo button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#segPeriodo button").forEach(x => x.classList.remove("ativo")); b.classList.add("ativo"); F.periodo = b.dataset.p; render(); });
  document.addEventListener("temamudou", () => render());
  render();
}
