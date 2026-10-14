# -*- coding: utf-8 -*-
"""
SERVIDOR DO PORTAL DE DEMANDAS - Dados & Insights - Facilities   (v6.2)
- Somente biblioteca padrão do Python.
- Login com SENHA DE REDE (Windows/AD), sem bloqueio por tentativas, sessão de 2 h.
- AVISOS e FAQ: só os "gestores" (config_portal.json) alteram.
- TEMPO REAL: /api/db/versao permite que as telas se atualizem sozinhas.
- E-mails pelas caixas do MIS e Facilities (config_email.json).
Uso:  python servidor_portal.py        (porta 8080)
"""
import csv, json, os, queue, re, secrets, shutil, smtplib, socket, subprocess, sys, tempfile, threading, time, traceback, webbrowser
from datetime import datetime
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

VERSAO_SERVIDOR = "6.2"
PASTA = os.path.dirname(os.path.abspath(__file__))
PASTA_DADOS = os.path.join(PASTA, "dados")
PASTA_ANEXOS = os.path.join(PASTA_DADOS, "anexos")
PASTA_BACKUP = os.path.join(PASTA_DADOS, "backup")
PASTA_EML = os.path.join(PASTA_DADOS, "emails_enviados")
ARQ_DB = os.path.join(PASTA_DADOS, "portal.json")
ARQ_ANEXOS = os.path.join(PASTA_ANEXOS, "_indice.json")
ARQ_LOG_EMAIL = os.path.join(PASTA_DADOS, "emails_log.csv")
ARQ_LOG_ACESSO = os.path.join(PASTA_DADOS, "acessos_log.csv")
ARQ_LOG_ERRO = os.path.join(PASTA_DADOS, "servidor_erros.log")
ARQ_CFG_EMAIL = os.path.join(PASTA, "config_email.json")
ARQ_CFG_PORTAL = os.path.join(PASTA, "config_portal.json")
LIMITE_ANEXO_MB = 25
COOKIE = "portal_token"

TRAVA = threading.Lock()
for p in (PASTA_DADOS, PASTA_ANEXOS, PASTA_BACKUP):
    os.makedirs(p, exist_ok=True)

DB_VAZIO = {"demandas": [], "historico": [], "comentarios": [], "emails": [], "perfis": {}, "seq": 0, "avisos": [], "faq": []}

CFG_EMAIL_PADRAO = {
    "metodo": "outlook",
    "link_portal": "http://10.11.4.40:8080",
    "avisar_equipe_em_novo_chamado": True,
    "remetente_mis": "indicadoresatendimentobr@amil.com.br",
    "remetente_facilities": "callcenterfacilitiessp@amil.com.br",
    "equipe_mis": ["indicadoresatendimentobr@amil.com.br"],
    "equipe_facilities": ["callcenterfacilitiessp@amil.com.br"],
    "smtp": {"servidor": "amil-com-br.mail.protection.outlook.com", "porta": 25, "starttls": True,
             "usuario": "", "senha": "", "remetente": ""}
}
CFG_PORTAL_PADRAO = {"autenticacao": "rede", "dominio": "", "sessao_horas": 2, "gestores": ["vi37114368", "ro37110232"]}


def agora():
    return datetime.now().strftime("%d/%m %H:%M:%S")


def registrar_erro(texto):
    try:
        with open(ARQ_LOG_ERRO, "a", encoding="utf-8") as f:
            f.write(f"\n[{datetime.now():%d/%m/%Y %H:%M:%S}]\n{texto}\n")
    except OSError:
        pass
    print(f"{agora()}  AVISO: {texto.strip().splitlines()[-1][:150]}  (detalhes em dados\\servidor_erros.log)")


def ler_json(caminho, padrao):
    if not os.path.exists(caminho):
        return padrao
    for tentativa in range(5):
        try:
            with open(caminho, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except (PermissionError, json.JSONDecodeError):
            if tentativa == 4:
                raise
            time.sleep(0.2)


def gravar_json(caminho, dados, bonito=False):
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=1 if bonito else None)
    for tentativa in range(10):
        try:
            os.replace(tmp, caminho)
            return
        except PermissionError:
            if tentativa == 9:
                raise
            time.sleep(0.3)


def backup_diario():
    if not os.path.exists(ARQ_DB):
        return
    destino = os.path.join(PASTA_BACKUP, f"portal_{datetime.now():%Y%m%d}.json")
    if not os.path.exists(destino):
        shutil.copy2(ARQ_DB, destino)


def ler_config(arq, padrao, nome):
    if not os.path.exists(arq):
        gravar_json(arq, padrao, bonito=True)
    try:
        return {**padrao, **ler_json(arq, {})}
    except Exception:
        registrar_erro(f"{nome} com erro de formatação (vírgula/aspas). Usando configuração padrão.")
        return json.loads(json.dumps(padrao))


def config_email():
    cfg = ler_config(ARQ_CFG_EMAIL, CFG_EMAIL_PADRAO, "config_email.json")
    cfg["smtp"] = {**CFG_EMAIL_PADRAO["smtp"], **cfg.get("smtp", {})}
    return cfg


def config_portal():
    return ler_config(ARQ_CFG_PORTAL, CFG_PORTAL_PADRAO, "config_portal.json")


def gestores():
    return [str(x).strip().lower() for x in (config_portal().get("gestores") or []) if str(x).strip()]


_CACHE_VERSAO = {"mtime": None, "versao": 0}


def versao_atual():
    try:
        mt = os.path.getmtime(ARQ_DB)
    except OSError:
        return 0
    if _CACHE_VERSAO["mtime"] != mt:
        with TRAVA:
            _CACHE_VERSAO["versao"] = int(ler_json(ARQ_DB, {"versao": 0}).get("versao", 0))
            _CACHE_VERSAO["mtime"] = mt
    return _CACHE_VERSAO["versao"]


# ---------------------------------------------------------------- AUTENTICAÇÃO DE REDE
ERROS_WINDOWS = {
    1326: "Usuário ou senha de rede incorretos.",
    1327: "Restrição de conta: não é permitido entrar agora.",
    1328: "Fora do horário permitido para sua conta.",
    1329: "Sua conta não pode entrar a partir deste computador.",
    1330: "Sua senha de rede expirou. Troque a senha no Windows e tente de novo.",
    1331: "Sua conta de rede está desabilitada.",
    1793: "Sua conta de rede expirou.",
    1907: "Você precisa trocar a senha de rede antes de entrar.",
    1909: "Sua conta de rede está BLOQUEADA. Procure o TI/Service Desk.",
    1311: "Servidor de domínio indisponível. Tente novamente em instantes.",
}


def normalizar_login(texto):
    t = (texto or "").strip()
    if "\\" in t:
        t = t.split("\\", 1)[1]
    if "@" in t:
        t = t.split("@", 1)[0]
    return t.lower()


def validar_senha_rede(usuario_digitado, senha, dominio_cfg):
    if os.name != "nt":
        return False, "Validação de rede só funciona no Windows."
    import ctypes
    from ctypes import wintypes
    adv = ctypes.WinDLL("advapi32", use_last_error=True)
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    adv.LogonUserW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.LPCWSTR,
                               wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    adv.LogonUserW.restype = wintypes.BOOL
    u = (usuario_digitado or "").strip()
    if "\\" in u:
        dominio, usuario = u.split("\\", 1)
    elif "@" in u:
        dominio, usuario = None, u
    else:
        dominio, usuario = (dominio_cfg or os.environ.get("USERDOMAIN") or None), u
    ultimo = 1326
    for tipo in (3, 2):
        h = wintypes.HANDLE()
        if adv.LogonUserW(usuario, dominio, senha, tipo, 0, ctypes.byref(h)):
            k32.CloseHandle(h)
            return True, ""
        ultimo = ctypes.get_last_error()
        if ultimo != 1385:
            break
    return False, ERROS_WINDOWS.get(ultimo, f"Não foi possível validar a senha (código {ultimo}).")


SESSOES = {}
TRAVA_SESSAO = threading.Lock()


def log_acesso(login, ip, situacao):
    novo = not os.path.exists(ARQ_LOG_ACESSO)
    try:
        with open(ARQ_LOG_ACESSO, "a", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            if novo:
                w.writerow(["data_hora", "login", "ip", "situacao"])
            w.writerow([datetime.now().strftime("%d/%m/%Y %H:%M:%S"), login, ip, situacao])
    except OSError:
        pass


def criar_sessao(login, horas):
    token = secrets.token_urlsafe(32)
    expira = time.time() + float(horas) * 3600
    with TRAVA_SESSAO:
        agora_ts = time.time()
        for t in [t for t, s in SESSOES.items() if s["expira"] < agora_ts]:
            del SESSOES[t]
        SESSOES[token] = {"login": login, "expira": expira}
    return token, expira


def sessao_do_token(token):
    if not token:
        return None
    with TRAVA_SESSAO:
        s = SESSOES.get(token)
        if s and s["expira"] < time.time():
            del SESSOES[token]
            return None
        return s


# ---------------------------------------------------------------- e-mail
FILA = queue.Queue()


def remetente_de(cfg, assunto):
    chave = "remetente_facilities" if "[FAC-" in (assunto or "") else "remetente_mis"
    return (cfg.get(chave) or "").strip()


def log_email(para, assunto, metodo, situacao, detalhe="", de=""):
    novo = not os.path.exists(ARQ_LOG_EMAIL)
    with open(ARQ_LOG_EMAIL, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        if novo:
            w.writerow(["data_hora", "de", "para", "assunto", "metodo", "situacao", "detalhe"])
        w.writerow([datetime.now().strftime("%d/%m/%Y %H:%M:%S"), de, para, assunto, metodo, situacao, str(detalhe)[:300]])


def enviar_outlook(para, assunto, html, remetente=""):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as t:
        json.dump({"para": para, "assunto": assunto, "html": html, "de": remetente}, t, ensure_ascii=False)
        arq = t.name
    ps = (
        "$ErrorActionPreference='Stop';"
        f"$d=Get-Content -Raw -Encoding UTF8 '{arq}' | ConvertFrom-Json;"
        "$o=New-Object -ComObject Outlook.Application;"
        "$m=$o.CreateItem(0);$m.To=$d.para;$m.Subject=$d.assunto;$m.HTMLBody=$d.html;"
        "if($d.de){"
        "  $c=$null; foreach($a in $o.Session.Accounts){ if($a.SmtpAddress -ieq $d.de){$c=$a} };"
        "  if($c){$m.SendUsingAccount=$c}else{$m.SentOnBehalfOfName=$d.de}"
        "};"
        "$m.Send()"
    )
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
                           capture_output=True, text=True, timeout=90,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout).strip()[:300] or "Falha no Outlook")
    finally:
        try:
            os.remove(arq)
        except OSError:
            pass


def montar_msg(remetente, para, assunto, html):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = remetente, para, assunto
    m.set_content(re.sub(r"<[^>]+>", " ", html))
    m.add_alternative(html, subtype="html")
    return m


def enviar_smtp(cfg, para, assunto, html):
    s = cfg["smtp"]
    msg = montar_msg(remetente_de(cfg, assunto) or s["remetente"], para, assunto, html)
    with smtplib.SMTP(s["servidor"], int(s["porta"]), timeout=30) as srv:
        srv.ehlo()
        if s.get("starttls"):
            srv.starttls()
            srv.ehlo()
        if s.get("usuario"):
            srv.login(s["usuario"], s["senha"])
        srv.send_message(msg)


def enviar_arquivo(cfg, para, assunto, html):
    os.makedirs(PASTA_EML, exist_ok=True)
    nome = f"{datetime.now():%Y%m%d_%H%M%S_%f}_{re.sub(r'[^\w]+', '_', assunto)[:60]}.eml"
    with open(os.path.join(PASTA_EML, nome), "wb") as f:
        f.write(bytes(montar_msg(remetente_de(cfg, assunto) or "portal@teste", para, assunto, html)))


def trabalhador_email():
    while True:
        item = FILA.get()
        try:
            cfg = config_email()
            metodo = str(cfg.get("metodo", "outlook")).lower()
            para, assunto, html = item["para"], item["assunto"], item["html"]
            de = remetente_de(cfg, assunto)
            try:
                if metodo == "desligado":
                    log_email(para, assunto, metodo, "ignorado", de=de)
                elif metodo == "smtp":
                    enviar_smtp(cfg, para, assunto, html); log_email(para, assunto, metodo, "enviado", de=de)
                elif metodo == "arquivo":
                    enviar_arquivo(cfg, para, assunto, html); log_email(para, assunto, metodo, "salvo .eml", de=de)
                else:
                    enviar_outlook(para, assunto, html, de); log_email(para, assunto, "outlook", "enviado", de=de)
                print(f"{agora()}  E-MAIL OK   -> {para} | {assunto}" + (f"  (de: {de})" if de else ""))
            except Exception as e:
                log_email(para, assunto, metodo, "ERRO", e, de=de)
                msg = str(e)
                dica = f"  >> Falta permissão 'Enviar como' na caixa {de} (pedir ao TI)." if de and re.search(r"permiss|permission|not allowed|on behalf|send as", msg, re.I) else ""
                print(f"{agora()}  E-MAIL ERRO -> {para} | {msg[:200]}{dica}")
        except Exception:
            registrar_erro(traceback.format_exc())
        finally:
            FILA.task_done()


def enfileirar_emails(lista):
    cfg = config_email()
    for e in lista or []:
        try:
            para = e.get("para") or ""
            if isinstance(para, list):
                para = "; ".join(x for x in para if x and "@" in x)
            if e.get("equipe"):
                if not cfg.get("avisar_equipe_em_novo_chamado"):
                    continue
                para = "; ".join(cfg.get("equipe_facilities" if e["equipe"] == "Facilities" else "equipe_mis") or [])
            if not para or "@" not in para:
                continue
            html = str(e.get("html", "")).replace("{{LINK_PORTAL}}", cfg.get("link_portal", ""))
            FILA.put({"para": para, "assunto": e.get("assunto", "Portal de Demandas"), "html": html})
        except Exception:
            registrar_erro(traceback.format_exc())


# ---------------------------------------------------------------- HTTP
ROTAS_LIVRES = {"/api/login", "/api/logout", "/api/versao", "/api/sessao"}


class Portal(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                      ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8"}

    def __init__(self, *a, **k):
        self._cookie_extra = None
        self.sessao = None
        super().__init__(*a, directory=PASTA, **k)

    def log_message(self, fmt, *args):
        pass

    def log_error(self, fmt, *args):
        pass

    def responder(self, codigo, corpo=None, tipo="application/json; charset=utf-8"):
        dados = b"" if corpo is None else (corpo if isinstance(corpo, bytes) else json.dumps(corpo, ensure_ascii=False).encode("utf-8"))
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        if self._cookie_extra:
            self.send_header("Set-Cookie", self._cookie_extra)
        self.end_headers()
        self.wfile.write(dados)

    def corpo(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def ip(self):
        return self.client_address[0] if self.client_address else ""

    def token(self):
        for parte in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = parte.strip().partition("=")
            if k == COOKIE:
                return v
        return ""

    def bloqueado(self):
        c = unquote(urlparse(self.path).path).lower()
        return c.startswith("/dados") or c.endswith((".py", ".bat", ".json", ".log"))

    def seguro(self, func):
        try:
            caminho = urlparse(self.path).path
            if caminho.startswith("/api/") and caminho not in ROTAS_LIVRES:
                self.sessao = sessao_do_token(self.token())
                if not self.sessao:
                    return self.responder(401, {"erro": "Sua sessão expirou. Entre novamente.", "sessao_expirada": True})
            func()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception:
            registrar_erro(f"{self.command} {self.path}\n{traceback.format_exc()}")
            try:
                self.responder(500, {"erro": "Erro interno no servidor. Tente novamente."})
            except Exception:
                pass

    def do_GET(self):
        self.seguro(self._get)

    def _get(self):
        url = urlparse(self.path)
        if url.path == "/favicon.ico":
            return self.responder(204)
        if url.path == "/api/versao":
            return self.responder(200, {"versao": VERSAO_SERVIDOR})
        if url.path == "/api/db/versao":
            return self.responder(200, {"versao": versao_atual()})
        if url.path == "/api/sessao":
            s = sessao_do_token(self.token())
            if not s:
                return self.responder(401, {"erro": "Sem sessão.", "sessao_expirada": True})
            return self.responder(200, {"login": s["login"], "expira": int(s["expira"] * 1000), "gestor": s["login"].lower() in gestores()})
        if url.path == "/api/db":
            with TRAVA:
                db = ler_json(ARQ_DB, {"versao": 0, "dados": DB_VAZIO})
            return self.responder(200, db)
        if url.path == "/api/anexos":
            did = int((parse_qs(url.query).get("demanda_id") or ["0"])[0])
            with TRAVA:
                idx = ler_json(ARQ_ANEXOS, {"seq": 0, "itens": []})
            return self.responder(200, [a for a in idx["itens"] if a["demanda_id"] == did])
        m = re.match(r"^/api/anexos/arquivo/(\d+)$", url.path)
        if m:
            with TRAVA:
                idx = ler_json(ARQ_ANEXOS, {"seq": 0, "itens": []})
            a = next((x for x in idx["itens"] if x["id"] == int(m.group(1))), None)
            if not a or not os.path.exists(os.path.join(PASTA_ANEXOS, a["arquivo"])):
                return self.responder(404, {"erro": "Anexo não encontrado."})
            with open(os.path.join(PASTA_ANEXOS, a["arquivo"]), "rb") as f:
                return self.responder(200, f.read(), a.get("tipo") or "application/octet-stream")
        if self.bloqueado():
            return self.responder(403, {"erro": "Acesso negado."})
        if url.path == "/":
            self.path = "/index.html"
        if not os.path.exists(self.translate_path(self.path)):
            return self.responder(404, f"Página não encontrada: {url.path}".encode("utf-8"), "text/plain; charset=utf-8")
        return super().do_GET()

    def do_PUT(self):
        self.seguro(self._put)

    def _put(self):
        if urlparse(self.path).path != "/api/db":
            return self.responder(404, {"erro": "Rota inválida."})
        try:
            env = json.loads(self.corpo().decode("utf-8"))
        except Exception:
            return self.responder(400, {"erro": "JSON inválido."})
        novos = env.get("dados") or DB_VAZIO
        with TRAVA:
            atual = ler_json(ARQ_DB, {"versao": 0, "dados": DB_VAZIO})
            if int(env.get("versao", -1)) != int(atual["versao"]):
                return self.responder(409, {"erro": "Base alterada por outro usuário.", "versao": atual["versao"]})
            antes = json.dumps([atual["dados"].get("avisos", []), atual["dados"].get("faq", [])], sort_keys=True)
            depois = json.dumps([novos.get("avisos", []), novos.get("faq", [])], sort_keys=True)
            if antes != depois and self.sessao["login"].lower() not in gestores():
                return self.responder(403, {"erro": "Somente a gestão pode alterar os Avisos e o FAQ."})
            backup_diario()
            novo = {"versao": atual["versao"] + 1, "dados": novos,
                    "gravado_em": datetime.now().isoformat(timespec="seconds"), "gravado_por": self.sessao["login"]}
            gravar_json(ARQ_DB, novo)
        if antes != depois:
            print(f"{agora()}  AVISOS/FAQ atualizados por {self.sessao['login']}")
        if env.get("emails"):
            enfileirar_emails(env["emails"])
        return self.responder(200, {"versao": novo["versao"]})

    def do_POST(self):
        self.seguro(self._post)

    def _login(self):
        try:
            d = json.loads(self.corpo().decode("utf-8") or "{}")
        except Exception:
            d = {}
        digitado, senha = (d.get("login") or "").strip(), d.get("senha") or ""
        login = normalizar_login(digitado)
        if not login or not senha:
            return self.responder(400, {"erro": "Informe o login e a senha de rede."})
        cfg = config_portal()
        if str(cfg.get("autenticacao", "rede")).lower() == "teste":
            ok, motivo = True, ""
        else:
            ok, motivo = validar_senha_rede(digitado, senha, cfg.get("dominio", ""))
        if not ok:
            log_acesso(login, self.ip(), f"NEGADO: {motivo}")
            print(f"{agora()}  LOGIN NEGADO -> {login} ({self.ip()}) | {motivo}")
            return self.responder(401, {"erro": motivo})
        token, expira = criar_sessao(login, cfg.get("sessao_horas", 2))
        segundos = int(float(cfg.get("sessao_horas", 2)) * 3600)
        self._cookie_extra = f"{COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={segundos}"
        log_acesso(login, self.ip(), "OK")
        print(f"{agora()}  LOGIN OK     -> {login} ({self.ip()})")
        return self.responder(200, {"login": login, "expira": int(expira * 1000)})

    def _logout(self):
        t = self.token()
        with TRAVA_SESSAO:
            s = SESSOES.pop(t, None)
        if s:
            log_acesso(s["login"], self.ip(), "SAIU")
        self._cookie_extra = f"{COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
        return self.responder(200, {"ok": True})

    def _post(self):
        url = urlparse(self.path)
        if url.path == "/api/login":
            return self._login()
        if url.path == "/api/logout":
            return self._logout()
        if url.path == "/api/email/teste":
            try:
                d = json.loads(self.corpo().decode("utf-8") or "{}")
            except Exception:
                d = {}
            para = d.get("para", "")
            enfileirar_emails([
                {"para": para, "assunto": "[MIS-TESTE] Teste de envio - caixa MIS",
                 "html": "<p>Teste da caixa do <b>MIS</b>. Se chegou, está funcionando. ✅</p>"},
                {"para": para, "assunto": "[FAC-TESTE] Teste de envio - caixa Facilities",
                 "html": "<p>Teste da caixa do <b>Facilities</b>. Se chegou, está funcionando. ✅</p>"}])
            return self.responder(200, {"ok": True})
        if url.path != "/api/anexos":
            return self.responder(404, {"erro": "Rota inválida."})
        q = parse_qs(url.query)
        did = int((q.get("demanda_id") or ["0"])[0])
        nome = (q.get("nome") or ["arquivo"])[0]
        tipo = (q.get("tipo") or ["application/octet-stream"])[0]
        dados = self.corpo()
        if len(dados) > LIMITE_ANEXO_MB * 1048576:
            return self.responder(413, {"erro": f"Arquivo acima de {LIMITE_ANEXO_MB} MB."})
        seguro = re.sub(r"[^\w.\- ]", "_", nome)[:120] or "arquivo"
        with TRAVA:
            idx = ler_json(ARQ_ANEXOS, {"seq": 0, "itens": []})
            idx["seq"] += 1
            arq = f"{did}_{idx['seq']}_{seguro}"
            with open(os.path.join(PASTA_ANEXOS, arq), "wb") as f:
                f.write(dados)
            reg = {"id": idx["seq"], "demanda_id": did, "nome": nome, "tipo": tipo, "tamanho": len(dados),
                   "arquivo": arq, "dt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            idx["itens"].append(reg)
            gravar_json(ARQ_ANEXOS, idx)
        return self.responder(200, reg)

    def do_DELETE(self):
        self.seguro(self._delete)

    def _delete(self):
        if urlparse(self.path).path != "/api/anexos":
            return self.responder(404, {"erro": "Rota inválida."})
        with TRAVA:
            for f in os.listdir(PASTA_ANEXOS):
                os.remove(os.path.join(PASTA_ANEXOS, f))
        return self.responder(200, {"ok": True})


class Servidor(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        registrar_erro(traceback.format_exc())


def enderecos():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    return socket.gethostname(), sorted(i for i in ips if not i.startswith("127."))


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8080
    abrir = "--sem-navegador" not in sys.argv
    try:
        servidor = Servidor(("0.0.0.0", porta), Portal)
    except OSError:
        print("=" * 70)
        print(f" A porta {porta} já está em uso: provavelmente o portal JÁ ESTÁ ABERTO")
        print(" em outra janela preta. Feche as outras janelas e rode de novo.")
        print("=" * 70)
        input(" Pressione Enter para sair...")
        sys.exit(1)
    threading.Thread(target=trabalhador_email, daemon=True).start()
    cfg, cfgp = config_email(), config_portal()
    nome, ips = enderecos()
    aut = str(cfgp.get("autenticacao", "rede")).lower()
    print("=" * 70)
    print(f" PORTAL DE DEMANDAS - Dados & Insights - Facilities  (ONLINE · v{VERSAO_SERVIDOR})")
    print("=" * 70)
    print(f" Neste computador : http://localhost:{porta}")
    for i in ips:
        print(f" Link para o time : http://{i}:{porta}")
    print(f" Pelo nome do PC  : http://{nome}.grupoamil.com.br:{porta}")
    if aut == "teste":
        print(" LOGIN            : MODO TESTE (qualquer senha entra!)  -> mude para \"rede\" em config_portal.json")
    else:
        print(f" LOGIN            : senha de rede · domínio {cfgp.get('dominio') or os.environ.get('USERDOMAIN', '?')}"
              f" · sessão de {cfgp.get('sessao_horas', 2)} h · sem bloqueio por tentativas")
    print(f" Avisos/FAQ       : editáveis por {', '.join(gestores()) or '(ninguém)'}")
    print(f" E-mails          : método '{cfg['metodo']}'")
    print(f"   MIS sai de        : {cfg.get('remetente_mis') or '(sua caixa)'}")
    print(f"   Facilities sai de : {cfg.get('remetente_facilities') or '(sua caixa)'}")
    if "onedrive" in PASTA.lower():
        print(" ATENÇÃO: a pasta está no OneDrive. Recomendado mover para C:\\Portal")
    print(" Para parar: feche esta janela (todos precisarão entrar de novo).")
    print("=" * 70)
    if abrir:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{porta}")).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
