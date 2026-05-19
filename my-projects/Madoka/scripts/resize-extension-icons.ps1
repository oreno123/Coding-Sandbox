# Build extension PNGs from end.png: per-size transparent canvas, scale, then flood-remove edge-connected pixels matching top-left (empty outer background).
# Requires Windows PowerShell + System.Drawing
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$destDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path -LiteralPath $destDir)) {
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}
$destDir = (Resolve-Path -LiteralPath $destDir).Path

$srcCandidates = @(
  (Join-Path $destDir "end.png"),
  "d:\desktop\大学\重要照片\end.png",
  "C:\Users\lenovo\.cursor\projects\d-desktop-abc\assets\d__desktop_________end.png"
)
$src = $null
foreach ($c in $srcCandidates) {
  if (Test-Path -LiteralPath $c) { $src = (Resolve-Path -LiteralPath $c).Path; break }
}
if (-not $src) {
  Write-Error "Source end.png not found. Place it at public/icons/end.png"
}
Write-Host "Source: $src"

function Matches-Ref {
  param([System.Drawing.Color]$c, [System.Drawing.Color]$ref, [int]$tol)
  return [Math]::Abs($c.R - $ref.R) -le $tol -and
         [Math]::Abs($c.G - $ref.G) -le $tol -and
         [Math]::Abs($c.B - $ref.B) -le $tol
}

function Remove-EdgeConnectedBackground {
  param(
    [System.Drawing.Bitmap]$bmp,
    [int]$Tolerance = 10
  )
  $w = $bmp.Width
  $h = $bmp.Height
  $ref = $bmp.GetPixel(0, 0)
  $visited = New-Object "bool[,]" $w, $h
  $q = New-Object System.Collections.Queue

  function Script:Try-EnqueueBg([int]$xx, [int]$yy) {
    if ($xx -lt 0 -or $yy -lt 0 -or $xx -ge $w -or $yy -ge $h) { return }
    if ($visited[$xx, $yy]) { return }
    $cc = $bmp.GetPixel($xx, $yy)
    if (-not (Matches-Ref $cc $ref $Tolerance)) { return }
    $visited[$xx, $yy] = $true
    [void]$q.Enqueue(@($xx, $yy))
  }

  for ($xi = 0; $xi -lt $w; $xi++) {
    Try-EnqueueBg $xi 0
    Try-EnqueueBg $xi ($h - 1)
  }
  for ($yi = 0; $yi -lt $h; $yi++) {
    Try-EnqueueBg 0 $yi
    Try-EnqueueBg ($w - 1) $yi
  }

  while ($q.Count -gt 0) {
    $p = $q.Dequeue()
    $px = $p[0]; $py = $p[1]
    Try-EnqueueBg ($px + 1) $py
    Try-EnqueueBg ($px - 1) $py
    Try-EnqueueBg $px ($py + 1)
    Try-EnqueueBg $px ($py - 1)
  }

  for ($xi = 0; $xi -lt $w; $xi++) {
    for ($yi = 0; $yi -lt $h; $yi++) {
      if ($visited[$xi, $yi]) {
        $bmp.SetPixel($xi, $yi, [System.Drawing.Color]::Transparent)
      }
    }
  }
}

function Save-Icon {
  param(
    [System.Drawing.Image]$source,
    [int]$PixelSize,
    [string]$FileName,
    [int]$BgTolerance = 10
  )
  $bmp = New-Object System.Drawing.Bitmap $PixelSize, $PixelSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.DrawImage($source, 0, 0, $PixelSize, $PixelSize)
  $g.Dispose()
  Remove-EdgeConnectedBackground $bmp $BgTolerance
  $out = Join-Path $destDir $FileName
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $out"
}

$srcImg = [System.Drawing.Image]::FromFile($src)
try {
  Save-Icon $srcImg 16  "icon16.png"  10
  Save-Icon $srcImg 32  "icon32.png"  10
  Save-Icon $srcImg 48  "icon48.png"  10
  Save-Icon $srcImg 128 "icon128.png" 10
} finally {
  $srcImg.Dispose()
}
Write-Host "Done."
