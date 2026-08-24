$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function ReplaceEmojis($file) {
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    
    $content = $content -replace '📋 Filtros e Relatórios', '<span data-icon="filtro" class="icon-sm"></span> Filtros e Relatórios'
    $content = $content -replace '⏱️ Banco de Horas', '<span data-icon="folder-clock" class="icon-sm"></span> Banco de Horas'
    $content = $content -replace '📍 Local de Trabalho', '<span data-icon="calendario" class="icon-sm"></span> Local de Trabalho'
    $content = $content -replace '❌ Rejeitar Solicitação', '<span data-icon="deni" class="icon-sm"></span> Rejeitar Solicitação'
    
    $content = $content -replace '✅', '<span data-icon="check" class="icon-sm"></span>'
    $content = $content -replace '❌', '<span data-icon="deni" class="icon-sm"></span>'
    $content = $content -replace '⏳', '<span data-icon="ampulheta" class="icon-sm"></span>'
    
    if ($file -match '\.html$') {
        $inject = @"
  <script type="module">
    import { insertSVGs } from "./js/svg.js";
    document.addEventListener("DOMContentLoaded", () => {
      insertSVGs();
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) insertSVGs();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  </script>
</body>
"@
        $content = $content -replace '</body>', $inject
    }
    
    [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
}

$files = @("admin.html", "dashboard.html", "index.html", "js\admin.js", "js\employee.js")
foreach ($f in $files) {
    ReplaceEmojis ((Get-Location).Path + "\" + $f)
}
