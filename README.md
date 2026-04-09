# Query Vault

## Overview

Query Vault is an internal admin feature for creating, validating, storing, and reusing saved SOQL queries in Salesforce.

The feature is surfaced in the `Ergon Internal Admin Tools` app through the `Query Vault` tab and is built around the `UsefulQuery__c` object.

Query Vault supports two main workflows:

- Create or edit one query at a time through the single-query editor  
- Create many queries at once through the bulk upload flow

## What The Feature Does

- Stores reusable SOQL queries in `UsefulQuery__c`  
- Validates SOQL before save  
- Associates each saved query with an `SObject API Name`  
- Lets users browse, open, copy, delete, and track usage of saved queries  
- Supports bulk creation from pasted spreadsheet rows or uploaded Excel workbooks

## Main UI Components

- `usefulQueries`  
  - Top-level container for the Query Vault page  
  - Loads shared query and object-option data from Apex  
- `queryEditor`  
  - Single-query create/edit workflow  
  - Validates SOQL and saves one query at a time  
- `bulkQueryEditor`  
  - Bulk creation workflow  
  - Supports paste or workbook upload  
  - Performs lightweight client-side validation before Apex submission  
- `queryLibrary`  
  - Displays the saved query library  
  - Supports view, copy, delete, and usage tracking actions

## Backend Services

- `QueryLibraryController`  
  - Returns available object options  
  - Returns saved query library rows  
  - Loads full query records for copy/edit flows  
  - Deletes records  
  - Tracks usage and last-used timestamps  
- `SoqlValidator`  
  - Validates single-query SOQL  
  - Saves single-query records  
  - Previews query execution with a capped record count  
  - Processes bulk upload validation and partial insert behavior

## Bulk Upload Flow

The bulk flow is designed for spreadsheet-based creation of many `UsefulQuery__c` records.

### Supported input modes

- Paste rows directly from Excel  
- Upload `.xlsx` or `.xls` files

### Expected columns

- `Name`  
- `Description`  
- `SObject API Name`  
- `SOQL`

### Template behavior

- The downloaded template supports up to 50 rows per upload  
- Upload parsing prefers a sheet named `Useful Queries Template`  
- If that sheet name is not present, the parser falls back to the first sheet in the workbook

## Validation Model

Query Vault uses two levels of validation.

### Frontend validation

The bulk editor performs lightweight validation before anything is sent to Apex.

It checks for:

- missing `Name`  
- missing `Description`  
- missing `SObject API Name`  
- missing `SOQL`  
- invalid `SObject API Name`  
- duplicate names within the uploaded batch

It also detects extra columns, but treats them as warnings only. Extra values are ignored and do not block submission if the required columns are otherwise valid.

### Backend validation

The Apex layer performs the heavier validation that should remain server-side.

It checks for:

- duplicate names already saved in Salesforce  
- invalid SOQL  
- invalid fields in SOQL  
- malformed clauses such as incomplete `LIMIT`  
- mismatch between the selected `SObject API Name` and the object used in the `FROM` clause

Bulk uploads use partial success behavior:

- valid rows are created  
- invalid rows are returned with per-row error messages  
- failed rows remain in the preview table for cleanup and retry

## Query Validation Notes

Single-query validation and bulk validation both reuse the same core SOQL validation service.

Current behavior:

- query must begin with `SELECT`  
- unsupported clauses such as `FOR UPDATE`, `ALL ROWS`, `WITH SYSTEM_MODE`, and `WITH USER_MODE` are blocked  
- validation runs the query with a capped `LIMIT`  
- if the query does not include a `LIMIT`, one is added automatically for validation

This keeps validation fast and reduces the chance of large accidental query execution during admin setup.

## Data Model

Primary object:

- `UsefulQuery__c`

Key fields used by the feature:

- `Name`  
- `UniqueName__c`  
- `DescriptionField__c`  
- `SObjectAPIName__c`  
- `SOQLField__c`  
- `UsageCount__c`  
- `LastUsedDate__c`

## App Metadata

The feature is included in:

- `Ergon Internal Admin Tools` app  
- `Query Vault` tab  
- `Query Vault` flexipage

Access is intended to be granted through the `Query_Vault_Access` permission set.

## Testing Notes

The feature includes both Apex and LWC test coverage for the main Query Vault flows.

Recent manual regression coverage has focused on:

- single-query validation and save  
- library loading and copy/delete behavior  
- bulk upload parsing from pasted rows  
- bulk upload parsing from uploaded Excel files  
- frontend-invalid upload scenarios  
- backend-invalid upload scenarios  
- row-limit handling  
- workbook header and sheet-selection edge cases

## Known Constraints

- Bulk upload is limited to 50 rows per submission  
- Workbook uploads currently support Excel files, not CSV upload  
- Workbook parsing prefers the expected template sheet name and otherwise uses the first sheet  
- Bulk validation intentionally leaves deeper SOQL validation in Apex instead of duplicating it in the client

## Related Files

- `force-app/main/default/lwc/usefulQueries`  
- `force-app/main/default/lwc/queryEditor`  
- `force-app/main/default/lwc/bulkQueryEditor`  
- `force-app/main/default/lwc/queryLibrary`  
- `force-app/main/default/classes/QueryLibraryController.cls`  
- `force-app/main/default/classes/SoqlValidator.cls`  
- `force-app/main/default/flexipages/Query_Vault.flexipage-meta.xml`  
- `force-app/main/default/tabs/Query_Vault.tab-meta.xml`  
- `force-app/main/default/permissionsets/Query_Vault_Access.permissionset-meta.xml`
