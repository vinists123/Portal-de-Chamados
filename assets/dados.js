/* ==========================================================================
   PORTAL DE DEMANDAS - Dados & Insights - Facilities   (v6.8)
   - MODO REDE (http://...): login com SENHA DE REDE, base única e e-mails reais
   - Sessão por INATIVIDADE: só desconecta depois de 2 h SEM USAR o portal
   - Pesquisa de satisfação (0 a 10) ao concluir o chamado: assets/pesquisa.js (carregado no final deste arquivo)
   - E-mail de chamado concluído traz o convite para a pesquisa de satisfação
   - MODO LOCAL (index.html com dois cliques): só para teste, sem e-mail
   ========================================================================== */

/* sinais de menor e maior (usados para montar HTML sem quebrar ao copiar e colar) */
const _LT = String.fromCharCode(60), _GT = String.fromCharCode(62);
const _A = (href, estilo, texto) => `${_LT}a href="${href}"${estilo ? ` style="${estilo}"` : ""}${_GT}${texto}${_LT}/a${_GT}`;

/* >>> NÍVEIS DE ACESSO <<<
   Nível 1 (qualquer login fora das listas): Nova solicitação + Minhas demandas
   Nível 2: Quadro do time só do seu escopo (MIS ou Facilities) + Análises só do que está atribuído a ele
   Nível 3: vê e gerencia tudo (Quadro + Análises completas)                                           */
const NIVEL3 = ["vi37114368", "ro37110232", "jo37117796", "admin"];   /* Vinicius, Rogerio e José Luiz Brugnara Junior */
const NIVEL2_FACILITIES = ["ga37097221", "maiza.santos", "gcnascimento"];
const NIVEL2_MIS = ["lu37107265", "felipe.couto", "ma37112881", "jo37097320", "ca37097345", "ro37124183"];
const ADMIN_MATRICULAS = [...NIVEL3, ...NIVEL2_FACILITIES, ...NIVEL2_MIS];
const ANALISE_MATRICULAS = [...ADMIN_MATRICULAS];

/* >>> PARA QUEM É O CHAMADO (1ª camada do formulário) <<< */
const DESTINOS = {
  "MIS":        {rotulo: "MIS · Dados & Insights", desc: "Análises, relatórios, dashboards, extrações e automações", icone: "📊", prefixo: "MIS", equipe: "time de Dados"},
  "Facilities": {rotulo: "Facilities", desc: "Acessos: reset de senha, criação, adequação e cancelamento", icone: "🔑", prefixo: "FAC", equipe: "time de Facilities"}
};
const destinoDe = d => (d && d.destino) || "MIS";
const equipeDe = destino => destino === "Facilities" ? [...NIVEL2_FACILITIES, ...NIVEL3.filter(l => l !== "admin")]
                                                     : [...NIVEL2_MIS, ...NIVEL3.filter(l => l !== "admin")];

/* >>> PERGUNTAS DO FACILITIES <<< */
const CAMPOS_FAC = [
  {id: "nome",      titulo: "Nome",                  tipo: "texto"},
  {id: "cpf",       titulo: "CPF",                   tipo: "cpf"},
  {id: "ilha",      titulo: "Ilha de Atendimento",   tipo: "texto"},
  {id: "sistema",   titulo: "Qual Sistema?",         tipo: "texto"},
  {id: "matricula", titulo: "Matrícula",             tipo: "texto"},
  {id: "email",     titulo: "E-mail",                tipo: "email"},
  {id: "login",     titulo: "Login",                 tipo: "texto"},
  {id: "a_partir",  titulo: "A partir de",           tipo: "data"},
  {id: "motivo",    titulo: "Motivo da solicitação", tipo: "texto"}
];
const EMAIL_OK = /^[^@\s]+@[^@\s]+[.][^@\s]+$/;
const cpfValido = c => { c = (c || "").replace(/\D/g, ""); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = s * 10 % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10]; };
const campoFacOk = (c, v) => { v = (v || "").trim(); if (!v) return false;
  if (c.tipo === "cpf") return cpfValido(v); if (c.tipo === "email") return EMAIL_OK.test(v); return true; };

const OPCOES = {
  operadoras: ["Amil", "Equipe Dados", "Total Care", "SOBAM", "Ana Costa", "Santa Helena", "Outro"],
  areas: ["Call Center", "Qualidade", "Planejamento", "Experiência do Cliente", "Ouvidoria", "Mídias", "NIP(regulatório)"],
  niveis: ["Interno", "Supervisão", "Coordenação", "Gerência", "Diretoria"],
  tipos: ["Análise", "Ajustes", "Criação de Dashboard", "Automação", "Extração de base", "Consultoria", "Robbyson", "Estudos / Projetos", "Outro"],
  status: ["Em Triagem", "Triagem Concluída", "Aguardando Solicitante", "Em Andamento", "Concluído", "Cancelado"],
  prioridades: ["Baixa", "Média", "Alta", "Urgente"],
  complexidades: ["Baixa", "Média", "Alta"],
  setores: ["Facilities - NEO AMIL", "Facilities - NEO TOTAL CARE", "Facilities - DBM", "Facilities - SOFT", "Facilities - AMIL"],
  solicitacoes_fac: ["Reset De Senha ( Geral)", "Cancelamento de Acesso", "Adequação de Acesso", "Criação de acessos"]
};
const SEGUNDA_PERGUNTA = {
  "Amil":         {campo: "area",  titulo: "Área Amil",               lista: "areas"},
  "Equipe Dados": {campo: "nivel", titulo: "Nível solicitante Dados", lista: "niveis"}
};
const ANEXO = {max: 10, maxMB: 25,
  accept: ".doc,.docx,.xls,.xlsx,.xlsm,.csv,.ppt,.pptx,.pdf,.txt,image/*,video/*,audio/*",
  texto: "Limite: 10 arquivos · até 25 MB cada · Word, Excel, PPT, PDF, Imagem, Vídeo, Áudio"};
const COR_TIPO = {"Análise": "ouro", "Ajustes": "lavanda", "Criação de Dashboard": "primaria", "Automação": "teal",
  "Extração de base": "teal", "Consultoria": "lavanda", "Robbyson": "primaria", "Estudos / Projetos": "ouro", "Outro": "neutro",
  "Reset De Senha ( Geral)": "teal", "Cancelamento de Acesso": "neutro", "Adequação de Acesso": "lavanda", "Criação de acessos": "primaria"};

/* ---------------- Tema claro / escuro ---------------- */
function temaAtual() { try { return localStorage.getItem("portal_tema") || "claro"; } catch (e) { return document.documentElement.dataset.tema || "claro"; } }
function aplicarTema(t) {
  document.documentElement.dataset.tema = t;
  try { localStorage.setItem("portal_tema", t); } catch (e) {}
  document.querySelectorAll(".btn-tema").forEach(b => b.textContent = t === "escuro" ? "☀️ Tema claro" : "🌙 Tema escuro");
  document.dispatchEvent(new Event("temamudou"));
}
function alternarTema() { aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro"); }
document.addEventListener("DOMContentLoaded", () => aplicarTema(temaAtual()));

/* ==========================================================================
   ARMAZENAMENTO + SESSÃO
   ========================================================================== */
const MODO_REDE = location.protocol === "http:" || location.protocol === "https:";
const LINK_LOCAL = "http://localhost:8080";
const SESSAO_HORAS_LOCAL = 2;
const ARMAZ = (function () {
  try { const k = "__t__"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; }
  catch (e) { window.__SEM_LS = true; const m = {};
    return {getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }}; }
})();
const LS = "portal_demandas_html_v1";
const LS_SESSAO = "portal_demandas_sessao_v1";
const DB_VAZIO = () => ({demandas: [], historico: [], comentarios: [], emails: [], perfis: {}, seq: 0});
let __VERSAO = 0, __ULTIMO = "", __FILA_EMAIL = [];

function lerSessao() { try { return JSON.parse(ARMAZ.getItem(LS_SESSAO) || "null"); } catch (e) { return null; } }
function gravarSessao(s) { if (s) ARMAZ.setItem(LS_SESSAO, JSON.stringify(s)); else ARMAZ.removeItem(LS_SESSAO); }
/* atualiza só o prazo de inatividade da sessão salva (todas as abas enxergam) */
function atualizarExpira(ms) { const s = lerSessao(); if (s && ms) { s.expira = ms; gravarSessao(s); } }
const naTelaLogin = () => { const p = (location.pathname.split("/").pop() || "").toLowerCase(); return p === "" || p === "index.html"; };
let __REDIRECIONANDO = false;
function sessaoExpirou(motivo = "expirou") {
  gravarSessao(null);
  if (!naTelaLogin() && !__REDIRECIONANDO) { __REDIRECIONANDO = true; location.href = "index.html?" + motivo + "=1"; }
}

function reqSinc(metodo, url, corpo) {
  const x = new XMLHttpRequest();
  x.open(metodo, url, false);
  if (corpo !== undefined) x.setRequestHeader("Content-Type", "application/json");
  try { x.send(corpo === undefined ? null : JSON.stringify(corpo)); }
  catch (e) { throw new Error("Servidor do portal indisponível. Verifique se ele está ligado."); }
  let r = null; try { r = JSON.parse(x.responseText || "null"); } catch (e) {}
  if (x.status === 401 && r && r.sessao_expirada) { sessaoExpirou(); throw new Error(r.erro || "Sessão expirada."); }
  return {status: x.status, dados: r};
}
async function fetchSeguro(url, opt) {
  const r = await fetch(url, {cache: "no-store", ...(opt || {})});
  if (r.status === 401) { sessaoExpirou(); throw new Error("Sua sessão expirou. Entre novamente."); }
  return r;
}
function carregarDB() {
  let base;
  if (MODO_REDE) {
    const r = reqSinc("GET", "api/db");
    if (r.status !== 200) throw new Error("Não foi possível ler a base do portal.");
    __VERSAO = r.dados.versao; base = r.dados.dados || DB_VAZIO();
  } else base = JSON.parse(ARMAZ.getItem(LS) || "null") || DB_VAZIO();
  delete base.sessao;
  __ULTIMO = JSON.stringify(base);
  base.sessao = lerSessao();
  return base;
}
function gravarDB(d) {
  const {sessao, ...base} = d;
  if (sessao) { const atual = lerSessao(); if (atual && atual.expira) sessao.expira = atual.expira; }
  gravarSessao(sessao);
  const txt = JSON.stringify(base), emails = __FILA_EMAIL; __FILA_EMAIL = [];
  if (txt === __ULTIMO) return;
  if (!MODO_REDE) { ARMAZ.setItem(LS, txt); __ULTIMO = txt; return; }
  const r = reqSinc("PUT", "api/db", {versao: __VERSAO, dados: base, emails});
  if (r.status === 409) throw new Error("Outra pessoa alterou o portal neste instante. Atualize a página (F5) e repita a ação.");
  if (r.status === 403) throw new Error((r.dados && r.dados.erro) || "Sem permissão para esta alteração.");
  if (r.status !== 200) throw new Error("Não foi possível salvar no servidor.");
  __VERSAO = r.dados.versao; __ULTIMO = txt;
  if (r.dados.expira) atualizarExpira(r.dados.expira);
}

/* ---------------- Anexos ---------------- */
const AnexosDB = MODO_REDE ? {
  async salvar(demanda_id, arquivos) {
    for (const f of arquivos) {
      const q = `api/anexos?demanda_id=${demanda_id}&nome=${encodeURIComponent(f.name)}&tipo=${encodeURIComponent(f.type || "application/octet-stream")}`;
      const r = await fetchSeguro(q, {method: "POST", body: f});
      if (!r.ok) throw new Error(`Falha ao enviar o anexo "${f.name}".`);
    }
  },
  async listar(demanda_id) {
    const r = await fetchSeguro(`api/anexos?demanda_id=${demanda_id}`);
    const lista = r.ok ? await r.json() : [];
    return lista.map(a => ({...a, url: `api/anexos/arquivo/${a.id}`}));
  },
  async limpar() { await fetchSeguro("api/anexos", {method: "DELETE"}); }
} : (function () {
  let p = null; const mem = []; let memId = 0;
  function abrir() {
    if (p) return p;
    p = new Promise(res => {
      try {
        const r = indexedDB.open("portal_demandas_anexos", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("anexos", {keyPath: "id", autoIncrement: true}).createIndex("demanda_id", "demanda_id");
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return p;
  }
  async function salvar(demanda_id, arquivos) {
    const db = await abrir();
    for (const f of arquivos) {
      const reg = {demanda_id, nome: f.name, tipo: f.type, tamanho: f.size, blob: f, dt: agoraStr()};
      if (!db) { reg.id = ++memId; mem.push(reg); continue; }
      await new Promise((res, rej) => { const tx = db.transaction("anexos", "readwrite"); tx.objectStore("anexos").add(reg); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    }
  }
  async function listar(demanda_id) {
    const db = await abrir();
    const l = !db ? mem.filter(a => a.demanda_id === demanda_id)
      : await new Promise((res, rej) => { const r = db.transaction("anexos").objectStore("anexos").index("demanda_id").getAll(demanda_id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return l.map(a => ({...a, url: URL.createObjectURL(a.blob)}));
  }
  async function limpar() {
    const db = await abrir(); mem.length = 0;
    if (db) await new Promise(res => { const tx = db.transaction("anexos", "readwrite"); tx.objectStore("anexos").clear(); tx.oncomplete = res; tx.onerror = res; });
  }
  return {salvar, listar, limpar};
})();

/* ---------------- Utilitários ---------------- */
const $ = s => document.querySelector(s);
/* protege textos digitados (troca & < > " ' pelo código numérico) */
const esc = s => (s ?? "").toString().replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const p2 = n => String(n).padStart(2, "0");
const dataStr = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const agoraStr = () => dataStr(new Date());
const paraData = s => new Date(s.replace(" ", "T"));
const fmt = s => s ? paraData(s).toLocaleString("pt-BR", {dateStyle: "short", timeStyle: "short"}) : "—";
const fmtD = s => s ? new Date(s + "T00:00").toLocaleDateString("pt-BR") : "—";
const tam = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.ceil(b / 1024)) + " KB";
const iniciais = n => (n || "").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
const tagCls = t => "tag-" + (COR_TIPO[t] || "neutro");
const extensao = n => ((n || "").split(".").pop() || "").toUpperCase().slice(0, 4);
const toast = m => { document.querySelectorAll(".toast").forEach(x => x.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); };
const erro = msg => { throw new Error(msg); };
const segundaTexto = d => d.setor ? `Setor: ${d.setor}` : d.area ? `Área: ${d.area}` : d.nivel ? `Nível: ${d.nivel}` : "";
const normNome = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
let __PERFIS = null, __PERFIS_T = 0;
const nomeDoLogin = l => { l = (l || "").toLowerCase();
  if (!__PERFIS || Date.now() - __PERFIS_T > 3000) { __PERFIS = carregarDB().perfis || {}; __PERFIS_T = Date.now(); }
  const p = __PERFIS[l]; return (p && p.nome) || l; };

/* ---------------- TMA (dias corridos) ---------------- */
const soData = s => s ? String(s).slice(0, 10) : null;
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 864e5);
const inicioTMA = d => d.dt_chegada || soData(d.dt_abertura);
const tmaPrevisto = d => d.prazo ? Math.max(0, diasEntre(inicioTMA(d), d.prazo)) : null;
const tmaRealizado = d => d.status === "Concluído" && d.dt_conclusao ? Math.max(0, diasEntre(inicioTMA(d), soData(d.dt_conclusao))) : null;
const tmaDecorrido = d => Math.max(0, diasEntre(inicioTMA(d), agoraStr().slice(0, 10)));

/* ---------------- Lista de verificação (etapas) ---------------- */
const progressoChecklist = d => {
  const l = (d && d.checklist) || [];
  if (!l.length) return null;
  const feitos = l.filter(i => i.feito).length;
  return {feitos, total: l.length, pct: Math.round(feitos / l.length * 100)};
};

window.onerror = (msg, src, lin) => { const e = $("#lgErro") || $("#formErro"); if (e) e.textContent = "Erro: " + msg + " (linha " + lin + ")"; };

/* ---------------- Sessão e permissões ---------------- */
function comFlags(s) {
  if (!s) return s;
  const l = (s.matricula || "").toLowerCase();
  s.nivel = NIVEL3.includes(l) ? 3 : (NIVEL2_FACILITIES.includes(l) || NIVEL2_MIS.includes(l)) ? 2 : 1;
  s.escopo = s.nivel === 2 ? (NIVEL2_FACILITIES.includes(l) ? "Facilities" : "MIS") : null;
  s.is_admin = s.nivel >= 2; s.is_analise = s.nivel >= 2; s.ve_tudo = s.nivel === 3;
  return s;
}
function podeGerir(u, d) { if (!u || !d) return false; if (u.nivel === 3) return true; return u.nivel === 2 && destinoDe(d) === u.escopo; }
function ehResponsavel(u, d) {
  if (!u || !d) return false;
  if (d.responsavel_login) return d.responsavel_login.toLowerCase() === (u.matricula || "").toLowerCase();
  return !!d.responsavel && normNome(d.responsavel) === normNome(u.nome);
}
function podeVerNaAnalise(u, d) { if (!u) return false; if (u.nivel === 3) return true; return u.nivel === 2 && destinoDe(d) === u.escopo && ehResponsavel(u, d); }
function sessao() {
  const s = lerSessao();
  if (!s) return null;
  if (s.expira && Date.now() >= s.expira) { sessaoExpirou(); return null; }   /* 2 h sem uso */
  try { const p = carregarDB().perfis[(s.matricula || "").toLowerCase()]; if (p) { s.nome = p.nome; s.email = p.email; } } catch (e) { return lerSessao() ? comFlags(s) : null; }
  return comFlags(s);
}
/* LOGIN: na rede valida a SENHA DE REDE no servidor (Windows/AD) */
function entrar(login, senha) {
  login = (login || "").trim();
  if (!login) erro("Informe o login de rede.");
  if (!senha) erro("Informe a senha de rede.");
  let matricula = login.toLowerCase(), expira = Date.now() + SESSAO_HORAS_LOCAL * 36e5;
  if (MODO_REDE) {
    const r = reqSinc("POST", "api/login", {login, senha});
    if (r.status !== 200) erro((r.dados && r.dados.erro) || "Não foi possível entrar.");
    matricula = r.dados.login; expira = r.dados.expira;
  }
  gravarSessao({matricula, nome: matricula, email: "", expira});
  const db = carregarDB(), perfil = db.perfis[matricula] || {nome: matricula, email: ""};
  const s = comFlags({matricula, nome: perfil.nome, email: perfil.email, expira});
  gravarSessao(s);
  return s;
}
function sair() {
  if (MODO_REDE) { try { reqSinc("POST", "api/logout", {}); } catch (e) {} }
  gravarSessao(null); location.href = "index.html?saiu=1";
}
function salvarPerfil(nome, email) {
  if (!EMAIL_OK.test((email || "").trim())) erro("E-mail inválido.");
  const db = carregarDB();
  db.sessao.nome = nome.trim() || db.sessao.matricula; db.sessao.email = email.trim();
  const l = db.sessao.matricula.toLowerCase();
  db.perfis[l] = {nome: db.sessao.nome, email: db.sessao.email};
  db.demandas.forEach(d => {
    if (d.solicitante_matricula === db.sessao.matricula) { d.solicitante_nome = db.sessao.nome; d.solicitante_email = db.sessao.email; }
    if ((d.responsavel_login || "").toLowerCase() === l) d.responsavel = db.sessao.nome;
  });
  gravarDB(db);
  return db.sessao;
}

/* ==========================================================================
   INATIVIDADE: o relógio do topo mostra quanto falta para sair SE ninguém mexer.
   Qualquer clique, tecla, rolagem ou movimento do mouse reinicia as 2 horas.
   ========================================================================== */
let __ULTIMA_ATIV = Date.now(), __ULTIMA_RENOV = 0, __RENOVANDO = false;
async function renovarSessao() {
  if (__RENOVANDO) return;
  __RENOVANDO = true; __ULTIMA_RENOV = Date.now();
  try {
    if (MODO_REDE) {
      const r = await fetch("api/sessao/renovar", {method: "POST", cache: "no-store"});
      if (r.status === 401) { sessaoExpirou(); return; }
      if (r.ok) atualizarExpira((await r.json()).expira);
    } else atualizarExpira(Date.now() + SESSAO_HORAS_LOCAL * 36e5);
  } catch (e) {} finally { __RENOVANDO = false; }
}
function registrarAtividade() {
  __ULTIMA_ATIV = Date.now();
  const s = lerSessao(); if (!s) return;
  const falta = (s.expira || 0) - Date.now();
  /* renova no máximo 1x por minuto (ou na hora, se estiver perto de expirar) */
  if (Date.now() - __ULTIMA_RENOV > 60000 || falta < 15 * 6e4) renovarSessao();
}
function iniciarRelogioSessao() {
  ["click", "keydown", "mousemove", "wheel", "touchstart", "scroll"].forEach(ev =>
    document.addEventListener(ev, registrarAtividade, {passive: true, capture: true}));
  let avisou = false;
  const tick = () => {
    const s = lerSessao();
    if (!s) { sessaoExpirou(); return; }
    const falta = (s.expira || 0) - Date.now(), el = $("#relogioSessao");
    if (falta <= 0) { sessaoExpirou(); return; }
    const m = Math.ceil(falta / 6e4), txt = m >= 60 ? `${Math.floor(m / 60)}h${p2(m % 60)}` : `${m} min`;
    if (el) {
      el.textContent = `⏱ ${txt}`; el.classList.toggle("acabando", m <= 10);
      el.title = "Tempo até sair por inatividade. Qualquer clique ou tecla reinicia a contagem.";
    }
    if (m <= 5 && !avisou) { avisou = true; toast("Você está sem usar o portal. Mexa o mouse ou clique para continuar conectado."); }
    if (m > 5) avisou = false;
  };
  tick(); setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  renovarSessao();   /* abrir uma tela também conta como uso */
}
function faixaModo() {
  return MODO_REDE
    ? `<div class="modo-local" style="background:var(--teal);color:#0F0D2E">PORTAL EM REDE · base compartilhada · e-mails ativos</div>`
    : `<div class="modo-local" style="background:#D92D20;color:#fff">⚠ Você abriu o arquivo direto (modo teste, sem e-mail e sem base compartilhada).
       ${_A(LINK_LOCAL, "color:#fff;font-weight:700;text-decoration:underline", `Clique aqui para abrir o portal correto (${LINK_LOCAL})`)}</div>`;
}
function iniciarPagina(ativa, acesso = false) {
  let u;
  try { u = sessao(); }
  catch (e) { document.body.innerHTML = `<div style="padding:40px;font-family:Segoe UI;text-align:center"><h2>⚠ ${esc(e.message)}</h2><p>Tente novamente em instantes ou avise o time de Dados.</p></div>`; return null; }
  if (!u) { if (!__REDIRECIONANDO) location.href = "index.html"; return null; }
  if ((acesso === true || acesso === "admin") && !u.is_admin) { location.href = "minhas.html"; return null; }
  if (acesso === "analise" && !u.is_analise) { location.href = u.is_admin ? "quadro.html" : "minhas.html"; return null; }
  const itens = [["formulario.html", "Nova solicitação"], ["minhas.html", "Minhas demandas"]];
  if (u.is_admin) itens.push(["quadro.html", "Quadro do time"]);
  if (u.is_analise) itens.push(["analises.html", "📊 Análises"]);
  const selo = u.nivel === 3 ? "Gestão · visão completa" : u.nivel === 2 ? `Time ${u.escopo === "Facilities" ? "Facilities" : "Dados & Insights"}` : "";
  const menu = itens.map(([h, l]) => `${_LT}a href="${h}" class="${h === ativa ? "ativo" : ""}"${_GT}${l}${_LT}/a${_GT}`).join("");
  document.body.insertAdjacentHTML("afterbegin", `
    ${faixaModo()}
    <header class="topo">
      <div class="topo-esq"><span class="logo">amil</span><span class="topo-titulo">Dados & Insights - Facilities</span></div>
      <nav id="menu">${menu}</nav>
      <div class="topo-dir"><button class="btn-tema" onclick="alternarTema()"></button>${selo ? `<span class="selo-nivel">${esc(selo)}</span>` : ""}<span id="relogioSessao" class="selo-nivel relogio"></span><span id="uNome" class="quebra">${esc(u.nome)}</span><button class="lnk" onclick="sair()">Sair</button></div>
    </header>
    <style>.relogio{display:inline-block!important}.relogio.acabando{background:#D92D20!important;border-color:#D92D20!important;color:#fff}</style>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="modal"></div>`);
  aplicarTema(temaAtual());
  iniciarRelogioSessao();
  return u;
}
function abrirPerfil(obrigatorio, depois) {
  const u = sessao();
  $("#modal").innerHTML = `<div class="center"><div class="box">
    <h3>Seus dados de contato</h3><p>As notificações das suas demandas serão enviadas para este e-mail.</p>
    <input id="pfNome" placeholder="Nome completo" value="${esc(u.nome === u.matricula ? "" : u.nome)}">
    <input id="pfEmail" type="email" placeholder="seu.email@amil.com.br" value="${esc(u.email)}">
    <div id="pfErro" style="color:var(--erro);font-size:13px;min-height:16px;margin-bottom:6px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      ${obrigatorio ? "" : `<button class="btn sec" onclick="fecharModal()">Cancelar</button>`}
      <button class="btn" id="pfSalvar">Salvar</button></div></div></div>`;
  $("#pfSalvar").onclick = () => {
    try { const s = salvarPerfil($("#pfNome").value, $("#pfEmail").value); fecharModal();
      if ($("#uNome")) $("#uNome").textContent = s.nome; if (depois) depois(s); }
    catch (e) { $("#pfErro").textContent = e.message; }
  };
}
function fecharModal() { const m = $("#modal"); if (m) m.innerHTML = ""; }

/* ==========================================================================
   E-MAILS (modelo HTML) — enviados pelo servidor junto com a gravação
   ========================================================================== */
function htmlEmail(d, titulo, mensagem, extra = "") {
  const fac = destinoDe(d) === "Facilities";
  const linhas = [["Protocolo", d.protocolo], ["Destino", DESTINOS[destinoDe(d)].rotulo],
    [fac ? "Setor" : "Operadora", fac ? d.setor : (d.operadora_outro || d.operadora)], ["Tipo", d.tipo_outro || d.tipo],
    ["Resumo", d.resumo], ["Status", d.status], ["Responsável", d.responsavel || "A definir"],
    ["Previsão de entrega", d.prazo ? fmtD(d.prazo) : "A definir"], ["Solicitante", `${d.solicitante_nome} (${d.solicitante_email})`]];
  if (fac && d.fac) linhas.push(["Colaborador", `${d.fac.nome} · ${d.fac.sistema} · login ${d.fac.login}`]);
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;color:#1B1846">
    <div style="background:linear-gradient(120deg,#17145E,#3B2FD9);color:#fff;padding:22px 26px;border-radius:14px 14px 0 0">
      <div style="font-size:26px;font-weight:700">amil</div>
      <div style="font-size:13px;opacity:.85">Portal de Demandas · Dados e Insights - Facilities</div></div>
    <div style="border:1px solid #E1DEF5;border-top:0;padding:22px 26px;border-radius:0 0 14px 14px">
      <h2 style="margin:0 0 8px;font-size:19px">${esc(titulo)}</h2>
      <p style="margin:0 0 16px;font-size:14px">${mensagem}</p>
      ${extra ? `<div style="background:#F4F2FF;border-left:4px solid #3B2FD9;padding:10px 14px;margin:0 0 16px;font-size:14px">${extra}</div>` : ""}
      <table style="border-collapse:collapse;width:100%;font-size:13.5px">${linhas.map(([k, v]) =>
        `<tr><td style="padding:6px 8px;color:#6B6893;width:170px;border-bottom:1px solid #EEECF9">${esc(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #EEECF9"><b>${esc(v || "—")}</b></td></tr>`).join("")}</table>
      <p style="margin:20px 0 0">${_A("{{LINK_PORTAL}}", "background:#3B2FD9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600", "Abrir o portal")}</p>
      <p style="font-size:11.5px;color:#8A87A8;margin-top:18px">E-mail automático. Para responder, use os comentários do card no portal.</p></div></div>`;
}
/* convite para a pesquisa de satisfação (vai no e-mail de chamado concluído) */
function htmlConviteNPS() {
  const escala = Array.from({length: 11}, (_, n) => {
    const cor = n <= 6 ? "#D92D20" : n <= 8 ? "#E0A100" : "#12B76A";
    return `<span style="display:inline-block;width:22px;height:22px;line-height:22px;margin:0 1px;border-radius:6px;background:${cor};color:#fff;font-size:11px;font-weight:700;text-align:center">${n}</span>`;
  }).join("");
  const botao = _A("{{LINK_PORTAL}}/minhas.html", "display:inline-block;margin-top:12px;background:#F0A400;color:#3A2600;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700", "⭐ Avaliar agora");
  return `<div style="margin-top:4px;padding:14px 16px;border-radius:12px;background:#FFF6DD;border:1px solid #F5C451;color:#3A2600">
    <div style="font-size:16px;font-weight:700;margin-bottom:6px">⭐ Sua opinião é muito importante para nós!</div>
    Gostaríamos de saber como foi o atendimento deste chamado. Ao acessar o portal, responda à pesquisa de satisfação:
    <b>de 0 a 10, qual o seu nível de satisfação com este chamado?</b>
    <div style="margin-top:10px">${escala}</div>
    <div style="margin-top:8px;font-size:12.5px">Leva menos de 10 segundos. Sua nota é usada para medir e melhorar a qualidade das nossas entregas.</div>
    ${botao}</div>`;
}
function registrarEmail(db, d, assunto, html, para) {
  para = para || d.solicitante_email;
  db.emails.push({demanda_id: d.id, para: para || "(equipe)", assunto, situacao: MODO_REDE ? "enviado ao servidor" : "simulado (modo teste)", dt_envio: agoraStr()});
  if (MODO_REDE) __FILA_EMAIL.push({para, assunto, html});
}
function emailEquipe(db, d) {
  if (!MODO_REDE) return;
  __FILA_EMAIL.push({equipe: destinoDe(d), assunto: `[${d.protocolo}] Novo chamado - ${d.resumo}`,
    html: htmlEmail(d, "Novo chamado recebido", `Um novo chamado foi aberto para o <b>${esc(DESTINOS[destinoDe(d)].equipe)}</b>.`, esc(d.descricao || ""))});
}
function emailResponsavel(db, d) {
  const l = (d.responsavel_login || "").toLowerCase(), p = db.perfis[l];
  if (!p || !p.email) return;
  registrarEmail(db, d, `[${d.protocolo}] Demanda atribuída a você - ${d.resumo}`,
    htmlEmail(d, "Demanda atribuída a você", `Olá, ${esc(p.nome.split(" ")[0])}. Esta demanda foi atribuída a você.`), p.email);
}

/* ---------------- Regras das demandas ---------------- */
function validarArquivos(lista, jaTem = 0) {
  if (lista.length + jaTem > ANEXO.max) erro(`Máximo de ${ANEXO.max} anexos por demanda.`);
  lista.forEach(f => { if (f.size > ANEXO.maxMB * 1048576) erro(`O arquivo "${f.name}" passa de ${ANEXO.maxMB} MB.`); });
}
async function criarDemanda(f, arquivos = []) {
  const db = carregarDB(), u = comFlags(db.sessao);
  if (!u) erro("Sessão expirada.");
  const destino = f.destino || "MIS", fac = destino === "Facilities";
  if (!DESTINOS[destino]) erro("Selecione para quem é o chamado (MIS ou Facilities).");
  let sp = null;
  if (fac) {
    if (!OPCOES.setores.includes(f.setor)) erro("Selecione o setor.");
    if (!OPCOES.solicitacoes_fac.includes(f.tipo)) erro("Selecione a solicitação de acesso.");
    CAMPOS_FAC.forEach(c => { if (!campoFacOk(c, (f.fac || {})[c.id])) erro(`Preencha corretamente: ${c.titulo}.`); });
  } else {
    if (!OPCOES.operadoras.includes(f.operadora)) erro("Selecione a operadora solicitante.");
    if (f.operadora === "Outro" && !(f.operadora_outro || "").trim()) erro("Informe qual é a operadora.");
    sp = SEGUNDA_PERGUNTA[f.operadora];
    if (sp && !OPCOES[sp.lista].includes(f[sp.campo])) erro(`Selecione: ${sp.titulo}.`);
    if (!OPCOES.tipos.includes(f.tipo)) erro("Selecione o tipo de demanda.");
  }
  if (!u.email) erro("Informe seu e-mail para receber as notificações.");
  validarArquivos(arquivos);
  const dt = agoraStr(), ano = dt.slice(0, 4);
  db.seq += 1;
  const pref = DESTINOS[destino].prefixo;
  const n = db.demandas.filter(x => (x.protocolo || "").startsWith(`${pref}-${ano}`)).length + 1;
  const d = {id: db.seq, protocolo: `${pref}-${ano}-${String(n).padStart(4, "0")}`, destino, setor: fac ? f.setor : null,
    fac: fac ? Object.fromEntries(CAMPOS_FAC.map(c => [c.id, String(f.fac[c.id]).trim()])) : null,
    operadora: fac ? null : f.operadora, operadora_outro: !fac && f.operadora === "Outro" ? f.operadora_outro.trim() : null,
    area: sp && sp.campo === "area" ? f.area : null, nivel: sp && sp.campo === "nivel" ? f.nivel : null,
    tipo: f.tipo, tipo_outro: !fac && f.tipo === "Outro" ? (f.tipo_outro || "").trim() || null : null,
    resumo: f.resumo.trim(), descricao: f.descricao.trim(),
    status: "Em Triagem", prioridade: "Média", complexidade: null, responsavel: null, responsavel_login: null, prazo: null, dt_chegada: dt.slice(0, 10),
    checklist: [],
    solicitante_matricula: u.matricula, solicitante_nome: u.nome, solicitante_email: u.email,
    anexos: arquivos.map(a => ({nome: a.name, tamanho: a.size})),
    dt_abertura: dt, dt_atualizacao: dt, dt_conclusao: null};
  db.demandas.push(d);
  db.historico.push({demanda_id: d.id, status_de: null, status_para: "Em Triagem", usuario: u.matricula, dt_evento: dt});
  registrarEmail(db, d, `[${d.protocolo}] Recebemos sua solicitação - ${d.resumo}`,
    htmlEmail(d, "Recebemos sua solicitação ✅", `Olá, ${esc(u.nome.split(" ")[0])}. Seu chamado foi registrado e já está na fila de triagem do <b>${esc(DESTINOS[destino].equipe)}</b>.`));
  emailEquipe(db, d);
  gravarDB(db);
  if (arquivos.length) await AnexosDB.salvar(d.id, arquivos);
  return d;
}
async function adicionarAnexos(id, arquivos) {
  arquivos = [...arquivos]; if (!arquivos.length) return;
  let db = carregarDB(), u = comFlags(db.sessao), d = db.demandas.find(x => x.id === id);
  if (!d || !(podeGerir(u, d) || d.solicitante_matricula === u.matricula)) erro("Demanda não encontrada.");
  validarArquivos(arquivos, (d.anexos || []).length);
  await AnexosDB.salvar(id, arquivos);
  db = carregarDB(); d = db.demandas.find(x => x.id === id);
  d.anexos = d.anexos || [];
  d.anexos.push(...arquivos.map(a => ({nome: a.name, tamanho: a.size})));
  d.dt_atualizacao = agoraStr();
  gravarDB(db);
}
function listarDemandas(todas) {
  const db = carregarDB(), u = comFlags(db.sessao);
  return db.demandas.filter(x => todas ? podeGerir(u, x) : x.solicitante_matricula === u.matricula)
    .sort((a, b) => b.id - a.id)
    .map(x => ({...x, qtd_comentarios: db.comentarios.filter(c => c.demanda_id === x.id).length}));
}
function detalheDemanda(id) {
  const db = carregarDB(), u = comFlags(db.sessao), d = db.demandas.find(x => x.id === id);
  if (!d || !(podeGerir(u, d) || d.solicitante_matricula === u.matricula)) erro("Demanda não encontrada.");
  return {demanda: d, historico: db.historico.filter(h => h.demanda_id === id),
    comentarios: db.comentarios.filter(c => c.demanda_id === id), emails: podeGerir(u, d) ? db.emails.filter(m => m.demanda_id === id) : []};
}
/* Lista de verificação: acao = {tipo:"add", texto} | {tipo:"marcar", item} | {tipo:"editar", item, texto} | {tipo:"remover", item} | {tipo:"mover", item, dir} */
function alterarChecklist(id, acao) {
  const db = carregarDB(), u = comFlags(db.sessao), d = db.demandas.find(x => x.id === id);
  if (!d) erro("Demanda não encontrada.");
  if (!podeGerir(u, d)) erro("Somente o time responsável pode alterar as etapas.");
  d.checklist = d.checklist || [];
  const i = d.checklist.findIndex(x => x.id === acao.item);
  if (acao.tipo === "add") {
    const t = (acao.texto || "").trim(); if (!t) erro("Escreva a etapa.");
    d.checklist.push({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), texto: t.slice(0, 200), feito: false, criado_por: u.matricula, dt: agoraStr()});
  } else if (i < 0) erro("Etapa não encontrada (foi removida?).");
  else if (acao.tipo === "marcar") {
    const it = d.checklist[i]; it.feito = !it.feito; it.feito_por = it.feito ? u.matricula : null; it.dt_feito = it.feito ? agoraStr() : null;
  } else if (acao.tipo === "editar") { const t = (acao.texto || "").trim(); if (!t) erro("A etapa não pode ficar vazia."); d.checklist[i].texto = t.slice(0, 200); }
  else if (acao.tipo === "remover") d.checklist.splice(i, 1);
  else if (acao.tipo === "mover") {
    const j = i + (acao.dir < 0 ? -1 : 1);
    if (j >= 0 && j < d.checklist.length) [d.checklist[i], d.checklist[j]] = [d.checklist[j], d.checklist[i]];
  }
  d.dt_atualizacao = agoraStr();
  gravarDB(db);
  return d;
}
function atualizarDemanda(id, a) {
  const db = carregarDB(), u = comFlags(db.sessao), d = db.demandas.find(x => x.id === id);
  if (!d) erro("Demanda não encontrada.");
  if (!podeGerir(u, d)) erro("Você não tem permissão para alterar esta demanda.");
  const dt = agoraStr();
  ["prioridade", "complexidade", "prazo", "dt_chegada"].forEach(c => { if (a[c] !== undefined && a[c] !== null) d[c] = String(a[c]).trim() || null; });
  let novoResp = false;
  if (a.responsavel_login !== undefined) {
    const l = (a.responsavel_login || "").trim().toLowerCase();
    if (l && !equipeDe(destinoDe(d)).includes(l) && l !== (d.responsavel_login || "")) erro("Responsável fora da equipe desta demanda.");
    novoResp = !!l && l !== (d.responsavel_login || "");
    d.responsavel_login = l || null;
    d.responsavel = l ? ((db.perfis[l] && db.perfis[l].nome) || l) : null;
  }
  const mudou = a.status && a.status !== d.status;
  if (mudou) {
    if (destinoDe(d) === "MIS" && d.status === "Em Triagem" && a.status !== "Cancelado" && !d.complexidade)
      erro("Checklist: preencha a Complexidade antes de tirar a demanda da triagem.");
    db.historico.push({demanda_id: id, status_de: d.status, status_para: a.status, usuario: u.matricula, dt_evento: dt});
    d.status = a.status;
    d.dt_conclusao = ["Concluído", "Cancelado"].includes(a.status) ? dt : null;
  }
  d.dt_atualizacao = dt;
  const com = (a.comentario || "").trim();
  if (com) db.comentarios.push({demanda_id: id, autor_matricula: u.matricula, autor_nome: u.nome, perfil: destinoDe(d) === "Facilities" ? "Time de Facilities" : "Time de Dados", texto: com, dt_comentario: dt});
  if (a.notificar !== false && (mudou || com)) {
    const concluiu = mudou && d.status === "Concluído";
    const titulo = concluiu ? "Seu chamado foi concluído ✅" : mudou ? `Status atualizado: ${d.status}` : `Novo comentário do ${DESTINOS[destinoDe(d)].equipe}`;
    const msg = concluiu ? `Sua demanda foi <b>concluída</b> pelo ${esc(DESTINOS[destinoDe(d)].equipe)}.`
      : d.status === "Aguardando Solicitante" && mudou
      ? "Precisamos de uma informação sua para continuar. <b>Responda pelo portal</b>, nos comentários do card."
      : mudou ? `Sua demanda mudou para <b>${esc(d.status)}</b>.` : "Há um novo comentário na sua demanda.";
    const extra = (com ? esc(com).replace(/\n/g, "<br>") : "")
      + (concluiu && !ADMIN_MATRICULAS.includes((d.solicitante_matricula || "").toLowerCase()) ? htmlConviteNPS() : "");
    registrarEmail(db, d, `[${d.protocolo}] ${concluiu ? "Concluído - avalie o atendimento" : titulo}`, htmlEmail(d, titulo, msg, extra));
  }
  if (novoResp) emailResponsavel(db, d);
  gravarDB(db);
}
function comentarDemanda(id, texto) {
  texto = (texto || "").trim(); if (!texto) erro("Comentário vazio.");
  const db = carregarDB(), u = comFlags(db.sessao), d = db.demandas.find(x => x.id === id);
  if (!d || !(podeGerir(u, d) || d.solicitante_matricula === u.matricula)) erro("Demanda não encontrada.");
  const dt = agoraStr(), solic = d.solicitante_matricula === u.matricula;
  db.comentarios.push({demanda_id: id, autor_matricula: u.matricula, autor_nome: u.nome, perfil: solic ? "Solicitante" : (destinoDe(d) === "Facilities" ? "Time de Facilities" : "Time de Dados"), texto, dt_comentario: dt});
  d.dt_atualizacao = dt;
  if (solic && d.status === "Aguardando Solicitante") {
    db.historico.push({demanda_id: id, status_de: d.status, status_para: "Em Andamento", usuario: u.matricula, dt_evento: dt});
    d.status = "Em Andamento";
  }
  if (!solic) registrarEmail(db, d, `[${d.protocolo}] Novo comentário do ${DESTINOS[destinoDe(d)].equipe}`,
    htmlEmail(d, "Novo comentário na sua demanda", "Há um novo comentário na sua demanda.", esc(texto).replace(/\n/g, "<br>")));
  else {
    const p = db.perfis[(d.responsavel_login || "").toLowerCase()];
    if (p && p.email) registrarEmail(db, d, `[${d.protocolo}] Solicitante respondeu - ${d.resumo}`,
      htmlEmail(d, "O solicitante respondeu", `${esc(u.nome)} comentou na demanda.`, esc(texto).replace(/\n/g, "<br>")), p.email);
  }
  gravarDB(db);
}

/* ---------------- Pesquisa de satisfação: nota válida (solicitante fora do time e após o reset) ---------------- */
function avaliacaoValida(d, db) {
  return !!(d && d.avaliacao) && !ADMIN_MATRICULAS.includes((d.solicitante_matricula || "").toLowerCase())
    && (d.dt_conclusao || "") >= ((db && db.pesquisa_desde) || "9999");
}

/* ---------------- Base de extração ---------------- */
function baixarCSV(nome, linhas) {
  if (!linhas.length) { toast("Nada para exportar."); return; }
  const cols = Object.keys(linhas[0]);
  const cel = v => { v = String(v ?? "").replace(/"/g, '""'); return /[;"\n\r]/.test(v) ? `"${v}"` : v; };
  const csv = "\uFEFF" + [cols.join(";"), ...linhas.map(l => cols.map(c => cel(l[c])).join(";"))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"})); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
}
function exportarBase(qual) {
  const db = carregarDB(), u = comFlags(db.sessao), hoje = agoraStr().slice(0, 10).replace(/-/g, "");
  const visiveis = db.demandas.filter(d => podeGerir(u, d)), ids = new Set(visiveis.map(d => d.id));
  const prot = id => (db.demandas.find(d => d.id === id) || {}).protocolo;
  if (qual === "demandas") baixarCSV(`base_demandas_${hoje}.csv`, visiveis.map(d => {
    const fim = d.dt_conclusao ? paraData(d.dt_conclusao) : new Date(), pr = progressoChecklist(d);
    return {protocolo: d.protocolo, destino: destinoDe(d), setor: d.setor || "", dt_abertura: d.dt_abertura, mes_abertura: d.dt_abertura.slice(0, 7),
      dt_chegada: inicioTMA(d), previsao_entrega: d.prazo, tma_previsto_dias: tmaPrevisto(d) ?? "", tma_realizado_dias: tmaRealizado(d) ?? "",
      etapas_total: pr ? pr.total : 0, etapas_concluidas: pr ? pr.feitos : 0, pct_concluido: pr ? pr.pct : "",
      ...Object.fromEntries(CAMPOS_FAC.map(c => ["fac_" + c.id, (d.fac || {})[c.id] || ""])),
      operadora: d.operadora_outro || d.operadora, area_amil: d.area, nivel_solicitante: d.nivel,
      tipo: d.tipo_outro || d.tipo, resumo: d.resumo,
      status: d.status, prioridade: d.prioridade, complexidade: d.complexidade, responsavel: d.responsavel, responsavel_login: d.responsavel_login || "", prazo: d.prazo,
      solicitante_matricula: d.solicitante_matricula, solicitante_nome: d.solicitante_nome, solicitante_email: d.solicitante_email,
      dt_atualizacao: d.dt_atualizacao, dt_conclusao: d.dt_conclusao,
      dias_em_aberto: ((fim - paraData(d.dt_abertura)) / 864e5).toFixed(2).replace(".", ","),
      qtd_anexos: (d.anexos || []).length, anexos: (d.anexos || []).map(a => a.nome).join(" | "),
      avaliacao_nota: avaliacaoValida(d, db) ? d.avaliacao.nota : "",
      avaliacao_comentario: avaliacaoValida(d, db) ? d.avaliacao.comentario || "" : "",
      avaliacao_dt: avaliacaoValida(d, db) ? d.avaliacao.dt : "",
      descricao: d.descricao};
  }));
  if (qual === "historico") baixarCSV(`historico_status_${hoje}.csv`, db.historico.filter(h => ids.has(h.demanda_id)).map(h => ({protocolo: prot(h.demanda_id), ...h})));
  if (qual === "comentarios") baixarCSV(`comentarios_${hoje}.csv`, db.comentarios.filter(c => ids.has(c.demanda_id)).map(c => ({protocolo: prot(c.demanda_id), ...c})));
}
async function limparBaseLocal() {
  const u = sessao();
  if (!u || u.nivel !== 3) { toast("Somente a gestão pode limpar a base."); return; }
  if (!confirm(MODO_REDE ? "ATENÇÃO: isto apaga TODAS as demandas e anexos do portal para TODOS os usuários. Continuar?"
                         : "Apagar TODAS as demandas e anexos de teste salvos neste navegador?")) return;
  const db = carregarDB();
  gravarDB({demandas: [], historico: [], comentarios: [], emails: [], perfis: db.perfis, seq: 0, sessao: db.sessao});
  await AnexosDB.limpar(); location.reload();
}
async function testarEmail(para) {
  const u = sessao(); para = para || (u && u.email);
  if (!MODO_REDE) { alert("Abra o portal pelo link http://localhost:8080 para testar o e-mail."); return; }
  await fetchSeguro("api/email/teste", {method: "POST", body: JSON.stringify({para})});
  toast(`Dois e-mails de teste (MIS e Facilities) enviados para ${para}. Veja a janela do servidor.`);
}

/* ==========================================================================
   PESQUISA DE SATISFAÇÃO — carrega assets/pesquisa.js em todas as telas (menos o login)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  if (naTelaLogin() || window.__PESQUISA_CARREGADA) return;
  window.__PESQUISA_CARREGADA = true;
  document.body.appendChild(Object.assign(document.createElement("script"), {src: "assets/pesquisa.js"}));
});
/* ==========================================================================
   INTERATIVO — responsáveis múltiplos (Quadro) e filtro cruzado (Análises)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  if (naTelaLogin() || window.__INTERATIVO_CARREGADO) return;
  window.__INTERATIVO_CARREGADO = true;
  document.body.appendChild(Object.assign(document.createElement("script"), {src: "assets/interativo.js"}));
});