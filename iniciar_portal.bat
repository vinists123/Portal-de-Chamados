@echo off
chcp 65001 >nul
title Portal de Demandas - Dados ^& Insights - Facilities  (NAO FECHE ESTA JANELA)
cd /d "%~dp0"
where python >nul 2>nul && (python servidor_portal.py 8080 & goto fim)
where py >nul 2>nul && (py servidor_portal.py 8080 & goto fim)
echo  [ERRO] Python nao encontrado. Instale pelo Portal da Empresa/TI e rode de novo.
:fim
pause
