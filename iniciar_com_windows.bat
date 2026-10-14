@echo off
chcp 65001 >nul
REM === Faz o portal ligar sozinho quando voce entrar no Windows ===
set "ALVO=%~dp0iniciar_portal.bat"
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Portal Demandas.lnk"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%ATALHO%');$s.TargetPath='%ALVO%';$s.WorkingDirectory='%~dp0';$s.WindowStyle=7;$s.Save()"
powercfg /change standby-timeout-ac 0
echo.
echo Pronto: o portal vai iniciar junto com o Windows e o PC nao vai dormir na tomada.
pause
