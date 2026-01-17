$ErrorActionPreference = 'Stop'

$packageName = 'document-stitcher'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$exePath = Join-Path $toolsDir 'document-stitcher.exe'

# Since this is a portable app, just ensure the exe is executable
# Chocolatey will automatically add the tools directory to PATH if it's a portable package

Write-Host "Document Stitcher has been installed. You can run it with 'document-stitcher' from the command line."