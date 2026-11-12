[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:LOCALAPPDATA 'naskah-runtime'
$modelPath = Join-Path $runtime 'e5-614241f6'
$servicePath = (Resolve-Path (Join-Path $PSScriptRoot '../tools/e5')).Path
$revision = '614241f622f53c4eeff9890bdc4f31cfecc418b3'
New-Item -ItemType Directory -Force $modelPath | Out-Null
foreach ($file in 'config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','model.safetensors') {
    $dest = Join-Path $modelPath $file
    if (!(Test-Path -LiteralPath $dest)) {
        curl.exe -fsSL --retry 2 "https://huggingface.co/intfloat/multilingual-e5-small/resolve/$revision/$file" -o "$dest.partial"
        if ($LASTEXITCODE) { throw "Download failed: $file" }
        Move-Item -LiteralPath "$dest.partial" -Destination $dest -Force
    }
}
$tokenFile = Join-Path $runtime 'e5.env'
if (!(Test-Path -LiteralPath $tokenFile)) {
    [IO.File]::WriteAllText($tokenFile, ('E5_TOKEN=' + [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')))
}
$existing = docker ps -a --filter 'name=^/sreques-e5$' --format '{{.Names}}'
if ($LASTEXITCODE) { throw 'Docker Desktop is unavailable' }
if ($existing -eq 'sreques-e5') {
    docker start sreques-e5 | Out-Null
} else {
    docker run -d --restart unless-stopped --name sreques-e5 --memory 3g --env-file $tokenFile -p 127.0.0.1:4011:4011 --mount "type=bind,source=$modelPath,target=/model,readonly" --mount "type=bind,source=$servicePath,target=/service,readonly" --entrypoint python naskah-evaluation:local /service/server.py | Out-Null
}
if ($LASTEXITCODE) { throw 'Could not start E5; run the local evaluation setup first.' }
$token = [IO.File]::ReadAllText($tokenFile).Trim().Substring(9)
for ($i = 0; $i -lt 45; $i++) {
    try {
        $models = Invoke-RestMethod 'http://127.0.0.1:4011/v1/models' -Headers @{Authorization="Bearer $token"} -TimeoutSec 2
        if ($models.data.id -contains 'multilingual-e5-small-614241f6-pad1536') {
            Write-Output 'Multilingual E5 ready on 127.0.0.1:4011.'
            return
        }
    } catch {}
    Start-Sleep -Seconds 1
}
throw 'E5 readiness check failed.'
