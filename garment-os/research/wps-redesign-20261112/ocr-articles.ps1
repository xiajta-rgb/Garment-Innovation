param([string]$Root)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
function Await-Result($Operation,$Type){$task=$asTask.MakeGenericMethod($Type).Invoke($null,@($Operation));$task.Wait();$task.Result}
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('zh-Hans-CN'))
$manifest=Get-Content -LiteralPath (Join-Path $Root 'corpus-read-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($article in $manifest){if(!$article.pictures){continue};$lines=[System.Collections.Generic.List[string]]::new();$count=0
 foreach($picture in $article.pictures){if($picture.downloadStatus -ne 'ok'){continue};$filePath=Join-Path $Root $picture.path;$ocrPath=$filePath+'.ocr.txt'
  if(Test-Path -LiteralPath $ocrPath){$content=Get-Content -LiteralPath $ocrPath -Raw -Encoding UTF8}else{
   try{$file=Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($filePath)) ([Windows.Storage.StorageFile]);$stream=Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream]);$decoder=Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder]);$bitmap=Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap]);$result=Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]);$content=($result.Lines | ForEach-Object {$_.Text}) -join "`n";[System.IO.File]::WriteAllText($ocrPath,$content,[System.Text.UTF8Encoding]::new($false));$stream.Dispose();$bitmap.Dispose()}catch{$content='OCR_ERROR: '+$_.Exception.Message}
  }
  $lines.Add('## image '+$picture.id+' | '+$picture.path);$lines.Add($content);$count++
 }
 [System.IO.File]::WriteAllText((Join-Path $Root ($article.wpsFileId+'.images-ocr.txt')),($lines -join "`n`n"),[System.Text.UTF8Encoding]::new($false));Write-Output ($article.wpsFileId+' images='+$count)
}
