# tools/fix-supabase.ps1
# Fix: ensure every file that uses supabase. has getSupabase import and a defined const supabase = getSupabase()

$ErrorActionPreference = "Stop"

$root = Join-Path (Get-Location) "src"
$exts = @(".ts", ".tsx", ".js", ".jsx")

$files = Get-ChildItem -Path $root -Recurse -File | Where-Object { $exts -contains $_.Extension }

function HasSupabaseDot($text) {
  return ($text -match '\bsupabase\s*\.')
}

function HasSupabaseConst($text) {
  return ($text -match 'const\s+supabase\s*=\s*getSupabase\s*\(\s*\)')
}

function HasGetSupabaseImport($text) {
  return ($text -match "import\s*\{\s*getSupabase\s*\}\s*from\s*['""]@/lib/supabase['""]")
}

function RemoveLegacySupabaseImport($text) {
  # remove: import { supabase } from '@/lib/supabase'
  $text = [regex]::Replace($text, "^\s*import\s*\{\s*supabase\s*\}\s*from\s*['""]@/lib/supabase['""]\s*;?\s*\r?\n", "", "Multiline")
  return $text
}

function EnsureGetSupabaseImport($lines) {
  $text = ($lines -join "`n")
  if (HasGetSupabaseImport $text) { return $lines }

  # Insert import after last import line at top
  $lastImportIdx = -1
  for ($i=0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line.TrimStart().StartsWith("import ")) {
      $lastImportIdx = $i
      continue
    }

    # stop scanning for "top imports" after first non-import line (except 'use client' or export const dynamic)
    $t = $line.Trim()
    if ($t -eq "" -or $t -eq "'use client'" -or $t -eq '"use client"' -or $t.StartsWith("export const dynamic")) {
      continue
    }

    if ($lastImportIdx -ge 0) { break }
  }

  $importLine = "import { getSupabase } from '@/lib/supabase'"
  if ($lastImportIdx -ge 0) {
    $before = $lines[0..$lastImportIdx]
    $after  = @()
    if ($lastImportIdx + 1 -lt $lines.Count) { $after = $lines[($lastImportIdx+1)..($lines.Count-1)] }
    return @($before + $importLine + $after)
  } else {
    # no imports found; insert after 'use client' if present, else at top
    $useClientIdx = -1
    for ($i=0; $i -lt [Math]::Min(10, $lines.Count); $i++) {
      if ($lines[$i].Trim() -match "^['""]use client['""]\s*;?\s*$") { $useClientIdx = $i; break }
    }
    if ($useClientIdx -ge 0) {
      $before = $lines[0..$useClientIdx]
      $after  = @()
      if ($useClientIdx + 1 -lt $lines.Count) { $after = $lines[($useClientIdx+1)..($lines.Count-1)] }
      return @($before + $importLine + $after)
    } else {
      return @($importLine + $lines)
    }
  }
}

function EnsureSupabaseConst($lines) {
  $text = ($lines -join "`n")
  if (HasSupabaseConst $text) { return $lines }

  # Insert const after the last import line (and after blank line if needed)
  $lastImportIdx = -1
  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].TrimStart().StartsWith("import ")) { $lastImportIdx = $i }
  }

  $constLine = "const supabase = getSupabase()"

  if ($lastImportIdx -ge 0) {
    $insertAt = $lastImportIdx + 1

    # keep a blank line between imports and const
    $before = @()
    if ($insertAt -gt 0) { $before = $lines[0..($insertAt-1)] }

    $after = @()
    if ($insertAt -lt $lines.Count) { $after = $lines[$insertAt..($lines.Count-1)] }

    # if next line isn't blank, add blank line
    if ($after.Count -gt 0 -and $after[0].Trim() -ne "") {
      return @($before + "" + $constLine + "" + $after)
    } else {
      return @($before + $constLine + "" + $after)
    }
  } else {
    # no imports: put near top (after use client if present)
    $useClientIdx = -1
    for ($i=0; $i -lt [Math]::Min(10, $lines.Count); $i++) {
      if ($lines[$i].Trim() -match "^['""]use client['""]\s*;?\s*$") { $useClientIdx = $i; break }
    }
    if ($useClientIdx -ge 0) {
      $before = $lines[0..$useClientIdx]
      $after  = @()
      if ($useClientIdx + 1 -lt $lines.Count) { $after = $lines[($useClientIdx+1)..($lines.Count-1)] }
      return @($before + "" + $constLine + "" + $after)
    } else {
      return @($constLine + "" + $lines)
    }
  }
}

$changed = 0

foreach ($f in $files) {
  $path = $f.FullName
  $text = Get-Content -Raw -Path $path

  if (-not (HasSupabaseDot $text)) { continue }

  $original = $text

  # remove legacy import { supabase }
  $text = RemoveLegacySupabaseImport $text

  $lines = $text -split "`r?`n"

  # ensure getSupabase import + const supabase
  $lines = EnsureGetSupabaseImport $lines
  $lines = EnsureSupabaseConst $lines

  $newText = ($lines -join "`n")

  if ($newText -ne $original) {
    Set-Content -Path $path -Value $newText -NoNewline
    $changed++
    Write-Host "Fixed: $($path.Replace((Get-Location).Path+'\',''))"
  }
}

Write-Host "`nDONE. Files changed: $changed"
