# Para o app que estiver rodando na porta 5180 e sobe de novo, sem janela.
# Usado pelo "npm run atualizar", depois de compilar a versão nova.
$porta = 5180
$conexoes = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conexoes) {
  Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
Start-Process wscript.exe -ArgumentList "`"$PSScriptRoot\iniciar-oculto.vbs`""
Write-Host "MEC Lineup reiniciado: http://localhost:$porta"
