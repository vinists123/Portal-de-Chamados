@echo off
chcp 65001 >nul
REM === Libera a porta 8080 no Firewall (somente rede interna 10.x) ===
net session >nul 2>&1 || (echo Clique com o botao direito neste arquivo e escolha "Executar como administrador". & pause & exit /b)
netsh advfirewall firewall delete rule name="Portal Demandas 8080" >nul 2>&1
netsh advfirewall firewall add rule name="Portal Demandas 8080" dir=in action=allow protocol=TCP localport=8080 profile=domain,private remoteip=10.0.0.0/8
echo.
echo Regra criada. Peca para um colega testar: http://10.11.4.40:8080
pause
