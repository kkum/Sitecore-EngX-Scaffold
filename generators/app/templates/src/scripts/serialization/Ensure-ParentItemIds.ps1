param(
    [string]$serializationRoot, 
    [string]$siteUrl,
    [string]$password
    )

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
Import-Module SPE
Write-Host "Processing $serializationRoot for $siteUrl" 

Get-ChildItem $serializationRoot -Recurse | 
    Where-Object { $_.Name -eq "SolutionX.yml"} |
    ForEach-Object {
        Write-Host "Processing $($_.FullName)" 
        $yml =  Get-Content $_.FullName | Out-String
        if ($yml -match  "(?mis)Parent: ""(?<oldParentId>\S+)"".*Path: (?<itemPath>(/.+)+/SolutionX)"){
            $itemPath = "master:$($matches['itemPath'])" 
            $oldParentId = $matches['oldParentId'] 
    
            $parentPath = (Split-Path $itemPath -Parent)
            $session = New-ScriptSession -Username admin -Password $password -ConnectionUri $siteUrl
            $newParentId = Invoke-RemoteScript -Session $session -ScriptBlock { (Get-Item -Path  "$($params.scPath)").Id.guid } -Arguments @{ scPath = $parentPath } 
            Stop-ScriptSession -Session $session
    
            if ($newParentId -and $oldParentId -ne $newParentId) {
                Write-Host "`$itemPath : $itemPath"
                Write-Host "`$parentPath : $parentPath"
                Write-Host "`$oldParentId : $oldParentId"
                Write-Host "`$newParentId : $newParentId"
                
                $yml = $yml -replace "$oldParentId", "$newParentId" 
                $yml | Out-String | Set-Content -Path $_.FullName
            } else{
                Write-Host "Nothing changed"
            }
        }
    }