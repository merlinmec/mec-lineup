# Liga ou desliga a inicialização automática do MEC Lineup junto com o Windows.
# Cria (ou remove) um atalho na pasta Inicializar do usuário; não precisa de admin.
param([switch]$Ligar, [switch]$Desligar)

$atalho = Join-Path ([Environment]::GetFolderPath('Startup')) 'MEC Lineup.lnk'

if ($Desligar) {
  Remove-Item $atalho -ErrorAction SilentlyContinue
  Write-Host 'Inicialização automática desligada.'
  exit 0
}

if ($Ligar) {
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($atalho)
  $lnk.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $lnk.Arguments = "`"$PSScriptRoot\iniciar-oculto.vbs`""
  $lnk.WorkingDirectory = Split-Path $PSScriptRoot -Parent
  $lnk.Description = 'Sobe o MEC Lineup em http://localhost:5180'
  $lnk.Save()
  Write-Host "Inicialização automática ligada ($atalho)."
  exit 0
}

Write-Host 'Use -Ligar ou -Desligar.'
exit 1
