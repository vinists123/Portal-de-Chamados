/* ==========================================================================
   TEMPO REAL - Quadro do time e Minhas demandas se atualizam sozinhos (sem F5)
   - A cada 4 s pergunta ao servidor se a base mudou (consulta leve)
   - Se mudou: redesenha o quadro, mantém filtros/rolagem e destaca o que mudou
   - Não atrapalha: espera se você estiver arrastando um card
   ========================================================================== */
(function () {
  if (typeof MODO_REDE === "undefined" || !MODO_REDE) return;
  if (typeof carregar !== "function" || typeof USER === "undefined" || !USER) return;
  const INTERVALO_MS = 4000;
  let versao = null, ocupado = false, ultimaAtualizacao = Date.now();

  document.head.insertAdjacentHTML("beforeend", `<style>
    .tr-vivo{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--texto-2);
      border:1px solid var(--borda);border-radius:14px;padding:3px 10px;margin-left:10px;background:var(--sup)}
    .tr-vivo i{width:8px;height:8px;border-radius:50%;background:#12B76A;box-shadow:0 0 0 0 rgba(18,183,106,.6);animation:trPulso 2s infinite}
    .tr-vivo.off i{background:#D92D20;animation:none}
    @keyframes trPulso{0%{box-shadow:0 0 0 0 rgba(18,183,106,.55)}70%{box-shadow:0 0 0 8px rgba(18,183,106,0)}100%{box-shadow:0 0 0 0 rgba(18,183,106,0)}}
    .tk.tr-mudou{animation:trBrilho 2.6s ease}
    @keyframes trBrilho{0%,35%{box-shadow:0 0 0 3px var(--ouro),0 6px 18px rgba(0,0,0,.18);transform:scale(1.02)}100%{box-shadow:none;transform:none}}
  </style>`);

  const titulo = document.querySelector(".planner-titulo");
  const selo = document.createElement("span");
  selo.className = "tr-vivo"; selo.innerHTML = "<i></i><span>Ao vivo</span>";
  if (titulo) titulo.appendChild(selo);
  const marcar = ok => { selo.classList.toggle("off", !ok); selo.lastChild.textContent = ok ? "Ao vivo" : "Sem conexão";
    selo.title = ok ? "Atualizado automaticamente · última atualização " + new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR") : "Servidor indisponível, tentando reconectar"; };

  const chave = d => d.status + "|" + (d.responsavel || "") + "|" + (d.qtd_comentarios || 0) + "|" + (d.dt_atualizacao || "");
  function atualizar() {
    const antes = new Map((DEMANDAS || []).map(d => [d.id, chave(d)]));
    const board = document.getElementById("board"), sx = board ? board.scrollLeft : 0, sy = window.scrollY;
    carregar();
    if (board) board.scrollLeft = sx; window.scrollTo(0, sy);
    const mudaram = (DEMANDAS || []).filter(d => antes.get(d.id) !== chave(d));
    mudaram.forEach(d => { const el = document.querySelector(`.tk[data-id="${d.id}"]`); if (el) el.classList.add("tr-mudou"); });
    if (mudaram.length && antes.size) {
      const d = mudaram[0], novo = !antes.has(d.id);
      toast(mudaram.length > 1 ? `Quadro atualizado: ${mudaram.length} demandas mudaram.`
        : novo ? `Nova demanda: ${d.protocolo}` : `${d.protocolo} → ${d.status}`);
    }
    ultimaAtualizacao = Date.now();
  }

  async function verificar() {
    if (ocupado || document.hidden) return;
    if (document.querySelector(".tk.dragging, .col.drag")) return;          /* arrastando um card */
    ocupado = true;
    try {
      const r = await fetch("api/db/versao", {cache: "no-store"});
      if (r.status === 401) { sessaoExpirou(); return; }
      if (!r.ok) { marcar(false); return; }
      const v = (await r.json()).versao;
      if (versao !== null && v !== versao) atualizar();
      versao = v; marcar(true);
    } catch (e) { marcar(false); }
    finally { ocupado = false; }
  }
  verificar();
  setInterval(verificar, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) verificar(); });
})();
