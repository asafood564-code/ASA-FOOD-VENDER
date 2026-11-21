$replacements = @{
    'red-50' = 'amber-50';
    'red-100' = 'amber-100';
    'red-200' = 'amber-200';
    'red-500' = 'amber-500';
    'red-600' = 'amber-600';
    'red-700' = 'amber-700';
    'red-800' = 'amber-800';
    'red-900' = 'amber-900';
    'shadow-red-' = 'shadow-amber-';
    'ring-red-' = 'ring-amber-';
    'hover:bg-red-700' = 'hover:bg-amber-600';
    '#D32F2F' = '#FFC107';
    'rgba(211, 47, 47' = 'rgba(255, 193, 7';
    'toggle-red-switch' = 'toggle-yellow-switch';
    'red-slider' = 'yellow-slider'
}

$files = "script.js", "style.css", "index.html"

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        foreach ($old in $replacements.Keys) {
            $content = $content.Replace($old, $replacements[$old])
        }
        $content | Set-Content $file
        Write-Output "Updated $file"
    }
}
