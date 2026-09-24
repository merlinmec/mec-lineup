@echo off
rem Sobe o app de uso (build + vite preview na porta 5180). Chamado pelo
rem iniciar-oculto.vbs; roda sem janela, com o log em logs\servidor.log.
cd /d "%~dp0.."
if not exist logs mkdir logs
if not exist dist\index.html call npm run build > logs\servidor.log 2>&1
call npm run servir > logs\servidor.log 2>&1
