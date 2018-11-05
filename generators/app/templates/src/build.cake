// //////////////////////////////////////////////////
// Dependencies
// //////////////////////////////////////////////////
#tool nuget:?package=Cake.Sitecore&prerelease
#load nuget:?package=Cake.Sitecore&prerelease
#addin "Cake.Powershell"



// //////////////////////////////////////////////////
// Arguments
// //////////////////////////////////////////////////
var Target = ArgumentOrEnvironmentVariable("target", "", "Default");
var ensureParentItemIdsScript = $"./scripts/serialization/Ensure-ParentItemIds.ps1";

// //////////////////////////////////////////////////
// Prepare
// //////////////////////////////////////////////////

Sitecore.Constants.SetNames();
Sitecore.Parameters.InitParams(
    context: Context,
    msBuildToolVersion: MSBuildToolVersion.VS2017,
    solutionName: "SolutionX",
    scSiteUrl: "https://WebsiteUriX", // default URL exposed from the box
    unicornSerializationRoot: "unicorn-SolutionUriX",
    publishingTargetDir : "LocalPathX",
    buildConfiguration : "Debug"
);

// //////////////////////////////////////////////////
// Tasks
// //////////////////////////////////////////////////

Task("000-Clean")
    .IsDependentOn(Sitecore.Tasks.ConfigureToolsTaskName)
    .IsDependentOn(Sitecore.Tasks.CleanWildcardFoldersTaskName)
    ;

Task("001-Restore")
    .IsDependentOn(Sitecore.Tasks.RestoreNuGetPackagesTask)
    .IsDependentOn(Sitecore.Tasks.RestoreNpmPackagesTaskName)
    ;

Task("002-Build")
    .IsDependentOn(Sitecore.Tasks.GenerateCodeTaskName)
    .IsDependentOn(Sitecore.Tasks.BuildClientCodeTaskName)
    .IsDependentOn(Sitecore.Tasks.BuildServerCodeTaskName)
    ;

Task("003-Tests")
    .IsDependentOn(Sitecore.Tasks.RunServerUnitTestsTaskName)
    .IsDependentOn(Sitecore.Tasks.RunClientUnitTestsTaskName)
    .IsDependentOn(Sitecore.Tasks.MergeCoverageReportsTaskName)
    ;

Task("004-Packages")
    .IsDependentOn(Sitecore.Tasks.CopyShipFilesTaskName)
    .IsDependentOn(Sitecore.Tasks.CopySpeRemotingFilesTaskName)
    .IsDependentOn(Sitecore.Tasks.PrepareWebConfigTask)
    .IsDependentOn(Sitecore.Tasks.RunPackagesInstallationTask)
    ;

Task("005-Publish")
    .IsDependentOn(Sitecore.Tasks.PublishFoundationTaskName)
    .IsDependentOn(Sitecore.Tasks.PublishFeatureTaskName)
    .IsDependentOn(Sitecore.Tasks.PublishProjectTaskName)
    ;

Task("006-Sync-Content")
    .IsDependentOn(Sitecore.Tasks.SyncAllUnicornItems)
    ;


// //////////////////////////////////////////////////
// Sub Tasks
// //////////////////////////////////////////////////
Task("Modify-Unicorn-Source-Folder")
    .Description("Update Source folder in Debug Mode")
    .Does(() => {
    if(Sitecore.Parameters.BuildConfiguration == "Debug") {
        var zzzDevSettingsFile = File($"{Sitecore.Parameters.PublishingTargetDir}/App_config/Include/Foundation/SolutionX.Foundation.Serialization.config");
        var rootXPath = "configuration/sitecore/sc.variable[@name='{0}']/@value";
        var sourceFolderXPath = string.Format(rootXPath, "SolutionX.SerializationSource");
        var xmlSetting = new XmlPokeSettings {
            Namespaces = new Dictionary<string, string> {
                {"patch", @"http://www.sitecore.net/xmlconfig/"}
            }
        };
        XmlPoke(zzzDevSettingsFile, sourceFolderXPath, $"{Sitecore.Parameters.SrcDir}/", xmlSetting);
    }
});

Task("Ensure-Yml-ItemIds")
    .Description("Update Yml files with proper parent id")
    .Does(() =>
{
    StartPowershellFile(ensureParentItemIdsScript, new PowershellSettings()
                                                        .SetFormatOutput()
                                                        .SetLogOutput()
                                                        .WithArguments(args => {
                                                            args.Append("serializationRoot", $"{Sitecore.Parameters.SrcDir}\\Foundation\\Serialization\\serialization\\LayersRoots")
                                                                .Append("siteUrl", Sitecore.Parameters.ScSiteUrl)
                                                                .Append("password", Sitecore.Parameters.ScAdminPassword );
                                                        }));
});

// //////////////////////////////////////////////////
// Targets
// //////////////////////////////////////////////////



Task("Default") // LocalDev
    .IsDependentOn("000-Clean")
    .IsDependentOn("001-Restore")
    .IsDependentOn("002-Build")
    // .IsDependentOn("003-Tests")
    .IsDependentOn("004-Packages")
    .IsDependentOn("005-Publish")
    .IsDependentOn("006-Sync-Content");

Task("Setup")
    .IsDependentOn("000-Clean")
    .IsDependentOn("001-Restore")
    .IsDependentOn("002-Build")
    // .IsDependentOn("003-Tests")
    .IsDependentOn("004-Packages")    
    .IsDependentOn("Ensure-Yml-ItemIds")
    .IsDependentOn("005-Publish")
    .IsDependentOn("Modify-Unicorn-Source-Folder")
    .IsDependentOn("006-Sync-Content");


Task("Build-and-Publish") // LocalDev
    .IsDependentOn("002-Build")
    .IsDependentOn("005-Publish");
// //////////////////////////////////////////////////
// Execution
// //////////////////////////////////////////////////

RunTarget(Target);