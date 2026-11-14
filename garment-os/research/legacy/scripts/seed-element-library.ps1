# 幂等注册脚本: 服装元素素材库 (应用元素 → 飞书记录)
# 用法: powershell -File scripts\seed-element-library.ps1
$ErrorActionPreference = 'Stop'
throw '旧静态种子入口已退役。数据库主档已维护；读取快照请运行 python scripts/sync-shape-library.py，补充当前参考入口用 configure-shape-library.py。禁止重新导入历史模拟模板。'
$baseToken = 'WeYeb0BiCauS3zsXTP1c2qoTnxh'
$tableId = 'tblI4uKwuTbKFFeT'
$repo = 'https://github.com/xiajta-rgb/Garment-Innovation'

$seed = Get-Content (Join-Path $PSScriptRoot 'element-seed.json') -Raw | ConvertFrom-Json
Write-Host "seed elements: $($seed.elements.Count)"

# 幂等键比对: 一次性拉全表 (来源素材标识 -> record_id), 避免搜索索引延迟/特殊字符不匹配
$existingMap = @{}
$listJson = lark-cli base +record-list --base-token $baseToken --table-id $tableId --as user --format json --field-id fldjbr7IVz 2>$null
try {
  $listObj = $listJson | ConvertFrom-Json
  $rIds = $listObj.data.record_id_list
  $rSrc = $listObj.data.data | ForEach-Object { $_[0] }
  for ($i = 0; $i -lt $rIds.Count; $i++) {
    if ($rSrc[$i]) { $existingMap[$rSrc[$i]] = $rIds[$i] }
  }
} catch {}
Write-Host "existing records in table: $($existingMap.Count)"

function Find-Record($sourceId) {
  if ($existingMap.ContainsKey($sourceId)) { return $existingMap[$sourceId] }
  return $null
}

$map = @{}
$created = 0; $existing = 0
foreach ($e in $seed.elements) {
  $recId = Find-Record $e.sourceId
  if ($recId) {
    $existing++
    Write-Host "EXISTS $($e.sourceId) -> $recId"
  } else {
    $fields = @{
      '素材名称' = $e.name
      '来源素材标识' = $e.sourceId
      '元素域' = @($e.domain)
      '元素类型' = @($e.type)
      '素材说明' = $e.description
      '适用类目' = $e.categories
      '来源渠道' = 'Garment-OS 制版引擎'
      '来源链接' = $repo
      '素材状态' = @('待核验')
      '标签核验状态' = @('未核验')
    } | ConvertTo-Json -Depth 5 -Compress
    $json = lark-cli base +record-upsert --base-token $baseToken --table-id $tableId --json $fields --as user --format json 2>$null
    try {
      $obj = $json | ConvertFrom-Json
      $recId = $obj.data.record.record_id_list[0]
      if (-not $recId) { $recId = $obj.data.record.record_id }
      if (-not $recId) { $recId = $obj.data.record_id }
    } catch { $recId = $null }
    if ($recId) { $created++; Write-Host "CREATED $($e.sourceId) -> $recId" }
    else { Write-Host "FAILED  $($e.sourceId)"; Write-Host $json }
  }
  if ($recId) { $map[$e.sourceId] = $recId }
}

# 回写映射
$out = @{}
foreach ($k in $map.Keys) { $out[$k] = $map[$k] }
$outPath = Join-Path $PSScriptRoot '..\src\data\elementRegistry.feishu.json'
$out | ConvertTo-Json -Depth 3 | Set-Content -Path $outPath -Encoding UTF8
Write-Host "`nSummary: created=$created existing=$existing total=$($map.Count)"
Write-Host "mapping written to $outPath"



