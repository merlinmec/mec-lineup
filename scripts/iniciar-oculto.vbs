' Roda o servir.cmd sem abrir janela de terminal (0 = oculto, False = não espera).
' É este arquivo que o atalho na inicialização do Windows chama.
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run """" & pasta & "\servir.cmd""", 0, False
