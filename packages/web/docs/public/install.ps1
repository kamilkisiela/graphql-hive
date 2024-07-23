#!/usr/bin/env pwsh

$version = if (Test-Path env:HIVE_CLI_VERSION) {
  $Env:HIVE_CLI_VERSION
} else {
  'latest'
}

function CreateWebClient {
param (
  [string]$url
 )
  $webClient = new-object System.Net.WebClient
  return $webClient
}

function DownloadContent {
param (
  [string]$url
 )
  $webClient = CreateWebClient $url
  return $webClient.DownloadString($url)
}

function ComputeDownloadLink() {
  $base_url = if ($version -eq 'latest') {
    "https://cli.graphql-hive.com/channels/stable/hive-win32"
  } else {
    "https://cli.graphql-hive.com/versions/$version/hive-v$version-win32"
  }

  # Detect if the system is x86 or x64
  $arch = if ([Environment]::Is64BitOperatingSystem) {
    "x64"
  } else {
    "x86"
  }

  # append the arch to the url
  return "$base_url-$arch.tar.gz"
}

function DownloadFile {
param (
  [string]$url,
  [string]$file
 )
  Write-Output "Downloading $url to $file"
  $webClient = CreateWebClient $url
  $webClient.DownloadFile($url, $file)
}

Function DeGZip-File{
    Param(
        $infile,
        $outfile = ($infile -replace '\.gz$','')
        )
    $input = New-Object System.IO.FileStream $inFile, ([IO.FileMode]::Open), ([IO.FileAccess]::Read), ([IO.FileShare]::Read)
    $output = New-Object System.IO.FileStream $outFile, ([IO.FileMode]::Create), ([IO.FileAccess]::Write), ([IO.FileShare]::None)
    $gzipStream = New-Object System.IO.Compression.GzipStream $input, ([IO.Compression.CompressionMode]::Decompress)
    $buffer = New-Object byte[](1024)
    while($true){
        $read = $gzipstream.Read($buffer, 0, 1024)
        if ($read -le 0){break}
        $output.Write($buffer, 0, $read)
        }
    $gzipStream.Close()
    $output.Close()
    $input.Close()
}

# Grab link to install Hive CLI
$finalLink = computeDownloadLink

# Create temporary directory for Hive CLI
$hiveTmpDir = Join-Path $env:TEMP "hive"
$hiveTmpFile = Join-Path $hiveTmpDir "hive-tmp.tgz"
if (![System.IO.Directory]::Exists($hiveTmpDir)) {[void][System.IO.Directory]::CreateDirectory($hiveTmpDir)}

# Download the file to the tmp folder
DownloadFile $finalLink $hiveTmpFile

# gunzip...
$gunzippedfile = Join-Path $hiveTmpDir "hive-tmp.tar"
DeGZip-File $hiveTmpFile $gunzippedfile

$hivePath = "$env:SYSTEMDRIVE\ProgramData\hive"
if (![System.IO.Directory]::Exists($hivePath)) {[void][System.IO.Directory]::CreateDirectory($hivePath)}

cd $hivePath
Write-Output "Extracting hive to $hivePath..."
$argumentList ="-xf $gunzippedfile"
Start-Process -FilePath "tar.Exe" -NoNewWindow -Wait -RedirectStandardError "./NUL" -ArgumentList $argumentList 

# delete hive temp directory
Remove-Item -LiteralPath $hiveTmpDir -Force -Recurse

$hiveInstalledFolderPath = Join-Path $hivePath 'hive'
$hiveBinFolderPath = Join-Path $hiveInstalledFolderPath 'bin'

# Add into path the hive bin folder for the user
if ($($env:Path).ToLower().Contains($($hiveBinFolderPath).ToLower()) -eq $false) {
  $currentPath = [Environment]::GetEnvironmentVariable('Path',[System.EnvironmentVariableTarget]::User);
  $newPath = "$currentPath;$hiveBinFolderPath";
  [System.Environment]::SetEnvironmentVariable('Path',$newPath,[System.EnvironmentVariableTarget]::User);
  $env:Path = $newPath;
}


# launch hive
hive --version

Write-Host "Hive CLI has been successfully installed" -ForegroundColor Green
