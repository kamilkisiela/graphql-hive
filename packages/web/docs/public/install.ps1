#!/usr/bin/env pwsh

function Install-Binary($install_args) {
  $old_erroractionpreference = $ErrorActionPreference
  $ErrorActionPreference = 'stop'

  Initialize-Environment

  # If the HIVE_CLI_VERSION env var is set, we use it instead of the latest version
  $version = if (Test-Path env:HIVE_CLI_VERSION) {
    $Env:HIVE_CLI_VERSION
  } else {
    'latest'
  }

  $exe = Download($version)
  Invoke-Installer "$exe" "$install_args"

  $ErrorActionPreference = $old_erroractionpreference
}

function Download($version) {
  $base_url = if ($version -eq 'latest') {
    "https://cli.graphql-hive.com/channels/stable/hive-"
  } else {
    "https://cli.graphql-hive.com/versions/$version/hive-v$version-"
  }

  # Detect if the system is x86 or x64
  $arch = if ([Environment]::Is64BitOperatingSystem) {
    "x64"
  } else {
    "x86"
  }

  # append the arch to the url
  $url = "$base_url$arch.exe"

  "Downloading Hive CLI from $url" | Out-Host
  $tmp = New-Temp-Dir
  $dir_path = "$tmp\hive.exe"
  $wc = New-Object Net.Webclient
  $wc.downloadFile($url, $dir_path)
  "Downloaded Hive CLI to $dir_path" | Out-Host
  return "$dir_path"
}

function Invoke-Installer($exe, $install_args) {
  & "$exe" "install" "$install_args"
  
  try {
    Remove-Item "$exe" -Force
  } catch [System.Management.Automation.ItemNotFoundException] {
    # ignore
  } catch [System.UnauthorizedAccessException] {
    $openProcesses = Get-Process -Name hive | Where-Object { $_.Path -eq "$exe" }
    if ($openProcesses.Count -gt 0) {
      Write-Output "Install Failed - An older installation exists and is open. Please close open Hive processes and try again."
      return 1
    }
    Write-Output "Install Failed - An unknown error occurred while trying to remove the existing installation"
    Write-Output $_
    return 1
  } catch {
    Write-Output "Install Failed - An unknown error occurred while trying to remove the existing installation"
    Write-Output $_
    return 1
  }
}

function Initialize-Environment() {
  # show notification to change execution policy:
  $allowedExecutionPolicy = @('Unrestricted', 'RemoteSigned', 'ByPass')
  If ((Get-ExecutionPolicy).ToString() -notin $allowedExecutionPolicy) {
    Write-Error "PowerShell requires an execution policy in [$($allowedExecutionPolicy -join ", ")] to run Hive CLI."
    Write-Error "For example, to set the execution policy to 'RemoteSigned' please run :"
    Write-Error "'Set-ExecutionPolicy RemoteSigned -scope CurrentUser'"
    break
  }
}

function New-Temp-Dir() {
  $parent = [System.IO.Path]::GetTempPath()
  [string] $name = [System.Guid]::NewGuid()
  $dir = New-Item -ItemType Directory -Path (Join-Path $parent $name)
  return $dir.FullName
}

Install-Binary "$Args"
