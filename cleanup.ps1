$content = Get-Content script.js
$newContent = $content[0..1058] + $content[1063..($content.Length-1)]
$newContent | Set-Content script.js
Write-Output "Removed old handleOrderAction"
