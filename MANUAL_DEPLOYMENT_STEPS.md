# Manual Deployment Steps - LookupMultiSelect PCF Control

## Overview
This guide provides **manual step-by-step instructions** (no scripts) to deploy the LookupMultiSelect PCF control into Dataverse.

---

## Build Commands (Prerequisites)

Before deployment, build the PCF control and solution using these commands:

### Step 0.1: Build PCF Control Bundle (npm)

```powershell
# Navigate to PCF project folder
cd C:\Basith\MultiSelectPCF\MultiSelectLookup

# Install npm dependencies (downloads required packages)
npm install

# Compile TypeScript, validate, and bundle the control
# This creates bundle.js in out/controls/ folder
npm run build
```

**Expected Output:**
- ESLint validation passes
- Webpack compilation succeeds
- Message: `[build] Succeeded`
- File created: `out/controls/LookupMultiSelect/bundle.js`

---

### Step 0.2: Restore NuGet Packages (dotnet)

```powershell
# Navigate to solution folder
cd C:\Basith\MultiSelectPCF\LookupMultiSelectSolution

# Download packages from local feed (first) then online (fallback)
# Uses nuget.config file that points to LocalNuGetFeed
dotnet restore --configfile ..\nuget.config
```

**Expected Output:**
- Packages restored successfully
- Message: `Restore complete`

---

### Step 0.3: Build Solution with MSBuild (dotnet)

```powershell
# Still in LookupMultiSelectSolution folder
cd C:\Basith\MultiSelectPCF\LookupMultiSelectSolution

# Compile solution, pack PCF control, and create ZIP file
# Output: C:\Basith\MultiSelectPCF\LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip
dotnet build
```

**Expected Output:**
- Processing components (Entities, CustomControls, etc.)
- Message: `Build succeeded`
- File created: `LookupMultiSelectSolution.zip` (~16-17 KB)

---

### Summary of Build Process

```
npm install          → Download dependencies
npm run build        → Compile PCF control (TypeScript → JavaScript bundle)
dotnet restore       → Download NuGet packages
dotnet build         → Pack solution into ZIP
```

**After build completes**: Solution ZIP is ready at `bin\Debug\LookupMultiSelectSolution.zip`

---

---

## Prerequisites

Before starting the deployment in Dataverse, you need:

### Software Requirements
- **Node.js & npm**: For building PCF control
- **.NET SDK**: For building solution
- **PAC CLI installed**: https://learn.microsoft.com/power-platform/developer/cli/introduction

### Access Requirements
- **Access to Dataverse environment** with admin permissions
- **Environment URL**: Example: `https://aikycdev.crm.dynamics.com`
- **Environment ID**: Get from Power Platform admin center or `pac auth list`

### Build Requirements (must complete these first)
- **Build PCF control**: Run `npm install` then `npm run build` (see Step 0.1 above)
- **Build solution**: Run `dotnet restore` then `dotnet build` (see Steps 0.2 and 0.3 above)
- **Solution ZIP file created**: `C:\Basith\MultiSelectPCF\LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip`

⚠️ **Important**: Complete Steps 0.1, 0.2, and 0.3 above BEFORE proceeding to Step 1

---

## Step 1: Authenticate with PAC CLI

### 1.1 Open Command Prompt or PowerShell

Navigate to any folder and open your terminal.

### 1.2 Create PAC Authentication

Run the following command:
```
pac auth create --url https://aikycdev.crm.dynamics.com
```

Replace `https://aikycdev.crm.dynamics.com` with your actual Dataverse environment URL.

**Expected Result:**
- Browser window opens asking for login
- Sign in with your credentials
- Authentication completes

### 1.3 Verify Authentication

Run:
```
pac auth list
```

You should see your environment listed with an **Environment ID** (GUID format).

Example output:
```
Name             URL                              Environment ID
Test Environment https://aikycdev.crm.dynamics.com d02fd3ad-da8c-e730-811b-c10412f15e11
```

**Copy the Environment ID** - you'll need it for import.

---

## Step 2: Import Solution into Dataverse

### Option A: Using PAC CLI (Command Line)

Run:
```
pac solution import --path "C:\Basith\MultiSelectPCF\LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip" --environment d02fd3ad-da8c-e730-811b-c10412f15e11
```

Replace `d02fd3ad-da8c-e730-811b-c10412f15e11` with your actual **Environment ID**.

**Expected Result:**
- Solution imports successfully
- Command completes within 1-2 minutes

### Option B: Using Power Platform Admin Center (GUI)

1. Navigate to: https://admin.powerplatform.microsoft.com
2. Select **Environments** → Select your environment
3. Click **Solutions** in the left navigation
4. Click **Import solution**
5. Click **Browse** and select the ZIP file:
   - `C:\Basith\MultiSelectPCF\LookupMultiSelectSolution\bin\Debug\LookupMultiSelectSolution.zip`
6. Click **Next**
7. Review the solution details
8. Click **Import** and wait for completion (1-2 minutes)

**Expected Result:**
- Green checkmark indicating successful import
- Solution appears in Solutions list

---

## Step 3: Create Required Tables in Dataverse

### 3.1 Create "Skill" Table

1. Open **Power Apps** (https://make.powerapps.com)
2. Select your environment
3. Go to **Dataverse** → **Tables** (left navigation)
4. Click **+ New table**
5. Enter:
   - **Display name**: `Skill`
   - **Plural name**: `Skills` (auto-filled)
   - **Schema name**: `new_skill` (auto-filled)
6. Click **Create**
7. Wait for table creation (30 seconds)

### 3.2 Create "Employee" Table

1. Click **+ New table** (again)
2. Enter:
   - **Display name**: `Employee`
   - **Plural name**: `Employees` (auto-filled)
   - **Schema name**: `new_employee` (auto-filled)
3. Click **Create**
4. Wait for table creation (30 seconds)

---

## Step 4: Add Lookup Field to Employee Table

### 4.1 Add "Skills" Lookup Field

1. Open the **Employee** table (click on it from Tables list)
2. Click **+ Add column** (or **Columns** tab → **+ New column**)
3. Enter:
   - **Display name**: `Skills`
   - **Data type**: Select **Lookup**
   - **Related table**: Select `Skill`
   - **Schema name**: `new_skills` (auto-filled)
4. Click **Advanced options** (if needed for more settings)
5. Click **Save column**
6. Wait for column creation

---

## Step 5: Add Additional Text Fields to Employee Table

### 5.1 Add "Selected Skills JSON" Field

1. Click **+ Add column**
2. Enter:
   - **Display name**: `Selected Skills JSON`
   - **Data type**: `Multiple lines of text`
   - **Max length**: `10000` (or higher)
   - **Schema name**: `new_selectedskillsjson`
3. Click **Save column**

### 5.2 Add "Selected Skill Names" Field

1. Click **+ Add column**
2. Enter:
   - **Display name**: `Selected Skill Names`
   - **Data type**: `Single line of text`
   - **Max length**: `10000` (default is fine)
   - **Schema name**: `new_selectedskillnames`
3. Click **Save column**

### 5.3 Publish Changes

1. Click **Publish** button (top right)
2. Wait for publishing to complete (30-60 seconds)

---

## Step 6: Add PCF Control to Employee Form

### 6.1 Open Employee Form

1. In Power Apps, go to Dataverse **Tables**
2. Select **Employee** table
3. Click **Forms** tab
4. Click **Main** form (default main form for the table)
5. Wait for form editor to load

### 6.2 Add Control to Skills Lookup Field

1. In the form editor, find and click the **Skills** field
2. In the **Properties** panel (right side), click the **Controls** tab
3. Click **+ Add control**
4. Search for or select: **LookupMultiSelect**
5. Click **Add**

### 6.3 Configure Control Properties

The control should now appear in the form. Now you need to set its properties:

1. Make sure **LookupMultiSelect** is the selected control
2. Scroll down to the **Properties** section at the bottom
3. Set the following values:

   | Property Name | Value |
   |---|---|
   | LookupEntityLogicalName | `new_skill` |
   | NameFieldLogicalName | `name` |
   | LookupEntityDisplayName | `Skill` |
   | LookupOption1LogicalName | (optional - leave blank if not needed) |
   | LookupOption2LogicalName | (optional - leave blank if not needed) |
   | hiddenField | `new_selectedskillsjson` |
   | recordNamesField | `new_selectedskillnames` |

4. Verify all values are entered correctly

### 6.4 Save the Form

1. Click **Save** button (top left)
2. Click **Publish** button
3. Wait for publishing to complete (30-60 seconds)

**Expected Result:**
- Form saves successfully
- You see a success message

---

## Step 7: Test the Control

### 7.1 Create Test Data - Skill Records

1. In Power Apps, go to **Skill** table
2. Click **+ New** to create new record
3. Enter **Name**: `C#`
4. Click **Save and close**
5. Repeat and create:
   - `JavaScript`
   - `SQL`
   - `TypeScript`

### 7.2 Create Test Employee Record

1. Go to **Employee** table
2. Click **+ New**
3. Enter **Name**: `John Doe`
4. Click **Save**

### 7.3 Test the Skills Control

1. In the **John Doe** employee record, find the **Skills** field (with LookupMultiSelect control)
2. Click in the search box
3. Type a skill name (e.g., "C#")
4. Select a skill from dropdown
5. Verify:
   - Skill appears as a **chip/badge** in the selected items
   - **"Selected Skills JSON"** field is auto-populated with JSON data
   - **"Selected Skill Names"** field shows comma-separated names
6. Try removing a skill by clicking the **X** on a chip
7. Verify the JSON updates accordingly

### 7.4 Test Quick Create (Optional)

1. In the Skills control search box
2. Click **New Skill** button (if available)
3. Quickly create a new skill
4. Verify it appears in available selections

---

## Step 8: Verify Field Values

### 8.1 Check Selected Skills JSON Field

1. Open the **John Doe** employee record
2. Scroll to **Selected Skills JSON** field
3. You should see JSON like:
   ```json
   [
     {"id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "entityType": "new_skill", "name": "C#"},
     {"id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy", "entityType": "new_skill", "name": "JavaScript"}
   ]
   ```

### 8.2 Check Selected Skill Names Field

1. Scroll to **Selected Skill Names** field
2. You should see: `C#, JavaScript, SQL` (comma-separated)

---

## Step 9: Troubleshooting

### Issue: Control doesn't appear on form
**Solution:**
- Verify **LookupMultiSelect** control is added to the **Skills** field
- Verify form is published
- Try refreshing the page (F5)
- Check browser console for errors (F12)

### Issue: Control shows but not working
**Solution:**
- Verify all property values are correct (check spelling and schema names)
- Ensure **hiddenField** points to `new_selectedskillsjson` (Multiple Lines of Text field)
- Ensure **recordNamesField** points to `new_selectedskillnames` (Single Line of Text field)
- Republish the form

### Issue: Skills dropdown empty
**Solution:**
- Verify **Skill** table has records created
- Verify **LookupEntityLogicalName** is set to `new_skill`
- Verify **NameFieldLogicalName** is set to `name`

### Issue: Quick Create button doesn't work
**Solution:**
- Ensure **Skill** table has **Quick Create** form enabled
- Go to Skill table → check Quick Create form is available

---

## Step 10: Additional Configuration (Optional)

### Add Subtext Fields to Display Additional Information

If you added **LookupOption1LogicalName** and **LookupOption2LogicalName**:

1. Edit Employee form
2. Click the **LookupMultiSelect** control
3. Set:
   - `LookupOption1LogicalName` = name of additional field on Skill table (e.g., `description`)
   - `LookupOption2LogicalName` = name of another field on Skill table (e.g., `new_level`)
4. Save and publish

The control will now display subtexts under each chip.

---

## Complete! 

Your LookupMultiSelect PCF control is now deployed and ready to use.

### Summary of Deployed Items
✓ Solution imported  
✓ Skill table created  
✓ Employee table created  
✓ Skills lookup field added to Employee  
✓ Supporting text fields added  
✓ PCF control configured on form  
✓ Tested and verified working  

---

## Quick Reference - All Schema Names Used

| Item | Schema Name |
|---|---|
| Skill table | new_skill |
| Employee table | new_employee |
| Skills lookup field | new_skills |
| Selected Skills JSON field | new_selectedskillsjson |
| Selected Skill Names field | new_selectedskillnames |

---
