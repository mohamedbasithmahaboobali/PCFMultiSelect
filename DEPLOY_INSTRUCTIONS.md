# Deployment Instructions — LookupMultiSelect PCF Control

This guide shows how to build and deploy the LookupMultiSelect PCF control into a Dataverse environment that has no access to nuget.org. It assumes you have already received the repository and the built solution ZIP (or will build it locally). Follow the steps in order.

## Summary
- Build the PCF bundle with `npm` (no NuGet required).
- Host required `.nupkg` files in a local feed inside the repository.
- Use `dotnet restore`/`dotnet build` configured to use the local feed.
- Pack/import the solution with the Power Platform CLI (`pac`).
- Create tables/fields and add the PCF control on the form (manual or scripted).

## Prerequisites
- Node.js and `npm` (for building the PCF control).
- .NET SDK (for `dotnet restore`/`dotnet build`).
- Power Platform CLI (`pac`) installed and authenticated to your environment.
- PowerShell (for optional helper scripts).
- The repo root on the client machine: `C:\Basith\MultiSelectPCF`.

Files/paths in this repo you will use:

- Solution ZIP (after build or pack): [LookupMultiSelectSolution/bin/Debug/LookupMultiSelectSolution.zip](LookupMultiSelectSolution/bin/Debug/LookupMultiSelectSolution.zip)
- PCF source: [MultiSelectLookup](MultiSelectLookup)
- Local feed folder (repo-local): `C:\Basith\MultiSelectPCF\LocalNuGetFeed`
- NuGet config (points to local feed): [nuget.config](nuget.config)
- Helper script (optional): [_download_and_build.ps1](_download_and_build.ps1)

## Prepare local NuGet feed (Optional — only if using MSBuild)

If you plan to use **MSBuild** (Option 2 above), you need the local NuGet feed. Otherwise, skip this section.

If your client environment blocks nuget.org, you must place the repository's `LocalNuGetFeed` folder (containing the `.nupkg` files) on the build machine. There are two ways to get the feed into the repo:

- Option A — you received the repo already containing `LocalNuGetFeed`: verify its contents (see verification step below).
- Option B — you received a separate download (ZIP) of the feed from an administrator. Copy or extract that `LocalNuGetFeed` folder into the repo root so the path is `C:\Basith\MultiSelectPCF\LocalNuGetFeed`.

Minimum packages used by this repo (you may see additional dependencies):
   - Microsoft.PowerApps.MSBuild.Solution
   - Microsoft.PowerApps.MSBuild.Pcf
   - Microsoft.NETFramework.ReferenceAssemblies

Copy or extract `.nupkg` files into the repo-local feed folder (example using PowerShell):

```powershell
# create the folder (if needed) and copy files into it
New-Item -ItemType Directory -Path "C:\Basith\MultiSelectPCF\LocalNuGetFeed" -Force
Copy-Item -Path "C:\temp\packages\*.nupkg" -Destination "C:\Basith\MultiSelectPCF\LocalNuGetFeed"
```

Verify the feed contents and that `nuget.config` points to it:

```powershell
# list files in the local feed
Get-ChildItem -Path "C:\Basith\MultiSelectPCF\LocalNuGetFeed" | Select-Object Name,Length

# quick check the nuget.config value
Get-Content .\nuget.config
```

`nuget.config` in the repo root should contain a source entry that references the local feed path, for example:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
   <packageSources>
      <add key="Local" value="C:\Basith\MultiSelectPCF\LocalNuGetFeed" />
   </packageSources>
</configuration>
```

Note: `dotnet restore` may require additional dependency `.nupkg` files. If `dotnet restore` complains about missing packages, obtain the missing `.nupkg` files and add them to `LocalNuGetFeed`, then re-run restore.

## Build the PCF control bundle (standalone reference)

To build the PCF bundle independently (without the full pack script):

```powershell
cd C:\Basith\MultiSelectPCF\MultiSelectLookup
npm install
npm run build
```

This produces the compiled control in the `out/controls` folder (used internally by solution packing).

## Build & Pack Solution (Two Options)

### Option 1: Using PAC CLI (Recommended — No NuGet Required)
If your environment blocks NuGet packages, use PAC CLI instead:

```powershell
# Run the provided script (builds PCF + packs solution with PAC)
cd C:\Basith\MultiSelectPCF
.\BUILD_AND_PACK_PAC.ps1
```

This approach:
- Builds the PCF bundle with `npm` (no NuGet needed)
- Packs the solution directly using `pac solution pack` (no MSBuild needed)
- Output: `C:\Basith\MultiSelectPCF\bin\LookupMultiSelectSolution.zip`

**Requirements:** [PAC CLI installed](https://learn.microsoft.com/power-platform/developer/cli/introduction)

### Option 2: Using MSBuild with Local NuGet Feed
If you have the local NuGet packages available, use MSBuild:

```powershell
cd C:\Basith\MultiSelectPCF\LookupMultiSelectSolution
dotnet restore --configfile ..\nuget.config
dotnet build
```

Output: `LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip`

## Pack the solution (manual step)

If you prefer to pack manually using PAC CLI:

```powershell
cd C:\Basith\MultiSelectPCF\LookupMultiSelectSolution
pac solution pack --zipfile ..\bin\LookupMultiSelectSolution.zip
```

The output ZIP will be at: `C:\Basith\MultiSelectPCF\bin\LookupMultiSelectSolution.zip`

## Import the solution into your Dataverse environment

You can import the generated solution ZIP using either the Power Platform admin center (GUI) or the Power Platform CLI (`pac`). This guide omits any automatic PowerShell-based import — perform the import interactively or via `pac` as below.

GUI (Power Platform admin center):
- Open the Power Platform admin center → Environments → select target environment → Solutions → Import
- Choose the ZIP file: `LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip` and follow the wizard to import.

Power Platform CLI (example):

```powershell
# authenticate interactively
pac auth create --url https://aikycdev.crm.dynamics.com

# import the solution (replace with your environment id)
pac solution import --path .\bin\Debug\LookupMultiSelectSolution.zip --environment d02fd3ad-da8c-e730-811b-c10412f15e11
```

## Create tables and fields (manual steps)
This control expects a parent table with a lookup to a target table (example: `Employee` uses `Skill`). Steps below create `Skill` and `Employee` manually in the maker portal.

1. Create `Skill` table
   - Power Apps → Dataverse → Tables → New table
   - Display name: `Skill` (schema name e.g., `new_skill`)
   - Primary name column: `name` (default)

2. Create `Employee` table
   - Display name: `Employee` (schema name e.g., `new_employee`)
   - Primary name column: `name`

3. Add columns to `Employee`:
   - `Skills` (Lookup) → Related table: `Skill` → Schema name: `new_skills`
   - `Selected Skills JSON` (Multiple Lines of Text) → Schema: `new_selectedskillsjson` → Max length large enough for JSON (e.g., 10000)
   - `Selected Skill Names` (Single Line of Text) → Schema: `new_selectedskillnames`

4. Save and Publish the changes.

## Add the PCF control to the form and map properties
1. Open the `Employee` main form in the maker portal.
2. Select the `Skills` lookup field → Controls tab → Add Control → Choose `LookupMultiSelect`.
3. Configure the control properties (use exact schema/logical names):
   - `LookupEntityLogicalName` = `new_skill`
   - `NameFieldLogicalName` = `name`  (this is the target table's primary name attribute)
   - `LookupEntityDisplayName` = `Skill`
   - `LookupOption1LogicalName` = (optional subtext 1)
   - `LookupOption2LogicalName` = (optional subtext 2)
   - `hiddenField` = `new_selectedskillsjson`
   - `recordNamesField` = `new_selectedskillnames`
4. Save the control configuration, Save the form, and Publish.

## Test & verify
1. Create sample `Skill` records (C#, JavaScript, SQL).
2. Open an `Employee` record and use the `Skills` control:
   - Search and select multiple skills — selected chips appear.
   - Remove a skill via the ✕ — chip disappears and JSON updates.
   - Click a selected name to open the Skill record.
   - Use the `New Skill` button (quick-create) to add a new skill and verify it appears in selections.
3. Inspect fields on the `Employee` record:
   - `Selected Skills JSON` (`new_selectedskillsjson`) should contain a JSON array of objects with `id`, `entityType`, `name`, and optional `subText1`/`subText2`.
   - `Selected Skill Names` (`new_selectedskillnames`) should contain comma-separated names.

## Troubleshooting
- If `dotnet restore` fails: ensure all required `.nupkg` files (and their dependencies) are present in `C:\Basith\MultiSelectPCF\LocalNuGetFeed` and `nuget.config` points to that folder.
- If the control does not render: confirm the control is added to the lookup field and the `hiddenField` mapping uses a Multiple Lines of Text column.
- If quick-create does not return newly created record: ensure quick-create is enabled for the `Skill` table.
- If `pac solution import` fails: ensure you are authenticated (`pac auth list`) and the environment id is correct.

## Automation options (advanced)
- You can automate table creation and form wiring using the Dataverse PowerShell module or the Web API. If you need a non-interactive automation script (service principal / client credentials), I can produce one for your environment; that requires a service principal with appropriate permissions.

- Note: this repository includes `_download_and_build.ps1` as a local helper example for building and provisioning. It is provided for reference; it is not required for manual `pac` or GUI solution import and will attempt interactive actions if executed.

---
If you want, I can also generate a small checklist or a single-run PowerShell checklist file (plain markdown or script) tailored to your environment. Which would you prefer next: a checklist or an automated (non-interactive) wiring script?
