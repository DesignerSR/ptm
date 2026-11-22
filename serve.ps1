# Minimal static dev server for the PTM site (no Node/Python needed).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 5173]
# Optional -UploadDir enables PUT /__upload/<name> (used once to extract video frames).
param(
  [int]$Port = 5173,
  [string]$Root = $PSScriptRoot,
  [string]$UploadDir = ''
)

$mime = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
  '.webp'='image/webp'; '.avif'='image/avif'; '.mp4'='video/mp4'; '.webm'='video/webm'; '.otf'='font/otf'
  '.ttf'='font/ttf'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.ico'='image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($UploadDir -and $req.HttpMethod -eq 'PUT' -and $path.StartsWith('/__upload/')) {
      $name = [IO.Path]::GetFileName($path.Substring(10))
      if (-not (Test-Path $UploadDir)) { New-Item -ItemType Directory -Force $UploadDir | Out-Null }
      $fs = [IO.File]::Create((Join-Path $UploadDir $name))
      $req.InputStream.CopyTo($fs); $fs.Close()
      $res.StatusCode = 201; $res.Close(); continue
    }

    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $Root $path.TrimStart('/')))
    if (-not $file.StartsWith([IO.Path]::GetFullPath($Root)) -or -not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404; $res.Close(); continue
    }

    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Accept-Ranges', 'bytes')
    $res.Headers.Add('Cache-Control', 'no-cache')

    $fs = [IO.File]::OpenRead($file)
    $len = $fs.Length; $start = 0; $end = $len - 1
    $range = $req.Headers['Range']
    if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
      if ($Matches[1]) { $start = [int64]$Matches[1] }
      if ($Matches[2]) { $end = [Math]::Min([int64]$Matches[2], $len - 1) }
      $res.StatusCode = 206
      $res.Headers.Add('Content-Range', "bytes $start-$end/$len")
    }
    $count = $end - $start + 1
    $res.ContentLength64 = $count
    if ($req.HttpMethod -ne 'HEAD') {
      $fs.Seek($start, 'Begin') | Out-Null
      $buf = New-Object byte[] 262144
      while ($count -gt 0) {
        $n = $fs.Read($buf, 0, [Math]::Min($buf.Length, $count))
        if ($n -le 0) { break }
        $res.OutputStream.Write($buf, 0, $n); $count -= $n
      }
    }
    $fs.Close()
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
