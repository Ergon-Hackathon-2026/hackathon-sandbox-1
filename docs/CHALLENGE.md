# Ergon Hackathon 2026 – QueryVault Challenge

- [Ergon Hackathon 2026 – QueryVault Challenge](#ergon-hackathon-2026--queryvault-challenge)
  - [Scenario](#scenario)
  - [Data Model Requirements](#data-model-requirements)
    - [1 Create the Core Custom Object](#1-create-the-core-custom-object)
    - [2 Required Fields and Intended Meaning](#2-required-fields-and-intended-meaning)
  - [App and UX Requirements (LWC)](#app-and-ux-requirements-lwc)
    - [3 Provide a Library Experience (Browse + Find)](#3-provide-a-library-experience-browse--find)
    - [4 Provide a Query Create/Edit Experience](#4-provide-a-query-createedit-experience)
    - [5 SObject Name Selection on Create or Update](#5-sobject-name-selection-on-create-or-update)
  - [Validation Requirements](#validation-requirements)
    - [6 Validate SOQL Syntax Before Save](#6-validate-soql-syntax-before-save)
    - [7 Prevent Harmful or Unbounded Validation Runs](#7-prevent-harmful-or-unbounded-validation-runs)
  - [CRED Requirements](#cred-requirements)
    - [8 Create Records (CRED: “C”)](#8-create-records-cred-c)
    - [9 Read Records (CRED: “R”)](#9-read-records-cred-r)
    - [10 Update Records (CRED: “E”)](#10-update-records-cred-e)
    - [11 Delete Records (CRED: “D”)](#11-delete-records-cred-d)
  - [Quality Requirements](#quality-requirements)
    - [12 Deliver Seed Data for Demo](#12-deliver-seed-data-for-demo)
    - [13 Provide a Minimal “How to Use” Guide](#13-provide-a-minimal-how-to-use-guide)
  - [MVP+ Requirements (Optional)](#mvp-requirements-optional)
    - [S1 Enforce Access via Permission Sets](#s1-enforce-access-via-permission-sets)
    - [S2 “Run Preview” (Safe Sample Execution)](#s2-run-preview-safe-sample-execution)
    - [S3 Pagination \& Performance Scaling](#s3-pagination--performance-scaling)
    - [S4 Organized Query Library](#s4-organized-query-library)
    - [S5 Bulk Data Handling](#s5-bulk-data-handling)
  - [MVP++ Requirements (Optional)](#mvp-requirements-optional-1)
    - [A1 Usage Analytics](#a1-usage-analytics)
    - [A2 Enhanced Object Design](#a2-enhanced-object-design)
    - [A3 Advanced UX Pattern](#a3-advanced-ux-pattern)
  - [Submission Checklist (What “Done” Looks Like)](#submission-checklist-what-done-looks-like)
  - [Technical Resources](#technical-resources)

---

> ⚠️ **Official Source of Truth**  
> This Markdown version mirrors the official problem statement.  
> In the event of discrepancies, the official Word document controls.
>
> 📄 **Official Problem Statement (Word Doc):**  
> [Open the official document](https://ergonus.sharepoint.com/:w:/s/ErgonsSalesForceSite/IQCa248PzDdYQ70zJVkefl6SAbl8oriFrN2kvX1OnEtcU1Q?e=MRhfIf)

---

## Scenario

The Ergon Salesforce team wants a centralized, reusable library of “useful SOQL queries” that can be safely shared across Admins, Developers, and QA.

Build **QueryVault**, an LWC-based CRED app that lets users create, validate, maintain, and reuse SOQL queries tied to Salesforce objects, without relying on scattered docs.

You are given the business intent and desired behaviors, but you must design the implementation details.

---

## Data Model Requirements

### 1 Create the Core Custom Object

**Requirement:**  
Implement a custom object to store reusable queries.

**Success Criteria**

- A custom object exists named `UsefulQuery__c`.
- Records represent one reusable query.
- The object includes all standard/custom fields outlined in #2.

See **Resources → Working with Custom Objects and Fields** for how to create objects and fields.

---

### 2 Required Fields and Intended Meaning

**Requirement:**  
Add fields to support naming, reuse, and clarity.

**Success Criteria**

- A required **Name** field exists and is user-meaningful (e.g., “Active Customers by Status”, “Open Cases by Priority and Status”).
- A required **SOQL field** exists:
  - Stores the query text (supports multi-line content).
- A required **Description field** exists:
  - Provides verbose context and usage notes (not used as the record’s primary label).
- A required **SObject API Name field** exists (`SObjectApiName__c`). (Highly recommend using a picklist where the options are all the API names)  
*Hint: utilize anonymous apex script to gather all object API names and use this to create a new line delineated list to create the values.*

*Hint: Label name and API name are two different things, and the Label name is what shows to the user in the UI.*

---

## App and UX Requirements (LWC)

### 3 Provide a Library Experience (Browse + Find)

**Requirement:**  
Build an LWC library UI that allows users to discover existing query records quickly.

**Success Criteria**

- Users can view a list of saved queries.
- Users can search by at least one of:
  - Name
  - Description
  - SOQL text (optional)
- Users can filter by SObject (using the selected object mechanism described below).
- The list avoids unnecessarily loading heavy content (e.g., SOQL body) for every row unless it’s intentionally displayed.

*Hint: Row action buttons on the data table can be utilized as one way to accomplish this.*

---

### 4 Provide a Query Create/Edit Experience

**Requirement:**  
Build an LWC editor for creating and updating query records.

**Success Criteria**

- Users can create a new query record from the UI.
- Users can edit an existing query record from the UI.
- The editor includes:
  - Name (required)
  - Description (required)
  - SObject selection (required)
  - SOQL query text (required)
- The form UX clearly indicates required fields and prevents incomplete submission.

Hint: utilize lightning record form, individual inputs, or validation rules

---

### 5 SObject Name Selection on Create or Update

**Requirement:**  
Users must select a valid SObject without typing the API name freehand. This should be done dynamically (e.g., via the Schema class or equivalent dynamic describe approach).

**Success Criteria**

- The UI provides a selectable list or searchable dropdown (see Lightning Combobox) of available SObjects.
- The stored SObject API Name is populated from the user’s selection.
- The user cannot save a record with an arbitrary/unknown SObject API Name that was typed manually.
- The solution works without hardcoding object API names.
- This requirement intentionally reduces reliance on controller-side Apex logic for “is object valid?” by providing query fetched object names.

*Hint: If you created the picklist in Step 2, this will make your job much easier here.*

---

## Validation Requirements

### 6 Validate SOQL Syntax Before Save

**Requirement:**  
Detect SOQL syntax errors and prevent saving invalid queries on record to create form submission.

**Success Criteria**

When the user attempts to create/save a useful query:

- Queries with SOQL syntax errors are detected reliably.
- The user receives a clear error message that indicates the query cannot run due to a syntax error.
- The system does not silently accept invalid SOQL.

> **Note:** You decide whether validation happens on-demand (“Validate” button) or automatically on Save, but your UX must make the validation outcome unambiguous.

*Hint:*  
*Highly recommended creating a separate validate button for SOQL validation*  
*Do not allow users to save record until SOQL is validated*  
*See resources doc for ideas/ instructions on approaches*

---

### 7 Prevent Harmful or Unbounded Validation Runs

**Requirement:**  
Validation must be safe and performance conscious.

**Success Criteria**

- The validation design does not run an unbounded query that could return massive results.
- The implementation includes at least one guardrail such as:
  - Enforcing a maximum row limit during validation
  - Rejecting unsafe patterns for validation execution
  - Constraining validation to parse/compile checks rather than full data retrieval
- Validation completes quickly for typical inputs.

---

## CRED Requirements

### 8 Create Records (CRED: “C”)

**Requirement:**  
Users can create useful query records from the LWC.

**Success Criteria**

- A user can successfully create a record with all required fields populated.
- The record appears in the library list after creation.
- If validation fails, the user is prevented from creating the record.

---

### 9 Read Records (CRED: “R”)

**Requirement:**  
Users can open and view stored queries.

**Success Criteria**

- Users can view Name, Description, SObject, and SOQL.
- Users can copy the SOQL text for reuse.
  - A copy button (or something similar) must be provided.
  - Cursor dragging and copying text is not sufficient.
- View experience is accessible from the library list. (See MVP+ for additional ideas here)

*Hint: Create/update UsefulQuery__c Lightning Record Page/Page Layout or see inline options on LWC*

---

### 10 Update Records (CRED: “E”)

**Requirement:**  
Users can update saved queries and keep them trustworthy.

**Success Criteria**

- Users can edit Name/Description/SObject/SOQL.
- If SOQL or SObject changes, the system re-validates under the same rules as creation.
- Updates persist and are reflected in the library list.

---

### 11 Delete Records (CRED: “D”)

**Requirement:**  
Users can delete records with guardrails.

**Success Criteria**

- Users can delete a query record from the UI.
- The delete action requires user intent (confirmation pattern or equivalent).
- After deletion, the record no longer appears in the library.

---

## Quality Requirements

### 12 Deliver Seed Data for Demo

**Requirement:**  
Provide sample records demonstrating realistic usage.

**Success Criteria**

- At least 10 sample `UsefulQuery__c` records exist (insertable via script, data loader, or manual creation).
- Records span multiple objects (e.g., Account, Case, Contact, Contract__c, etc.).
- Records include meaningful Names and Descriptions.

See docs folder in repo for existing queries

---

### 13 Provide a Minimal “How to Use” Guide

**Requirement:**  
Document how users should use the app.

**Success Criteria**

A short README into docs folder of repo or internal doc exists describing:

- What the app is for
- How to find and copy a query
- How validation works (high level)
- Any guardrails/limitations (e.g., validation enforces a limit)

---

## MVP+ Requirements (Optional)

MVP+ (Nice Additions implement in no particular order)

### S1 Enforce Access via Permission Sets

**Requirement:**  
Ensure only the right users can create/edit/delete, while others can view.

**Success Criteria**

- At least two access levels are defined (e.g., Viewer vs Editor).
- Users without edit permissions can still browse and view records but cannot modify them.
- The app respects object-level CRED and does not bypass security.

*Hint:*  
It is recommended that students create test user accounts that are not admin accounts to test security  
Highly recommend creating permission sets to administer said security rules

### S2 “Run Preview” (Safe Sample Execution)

**Success Criteria**

- Users can preview results (first N rows).
- Preview is constrained to a safe row count and shows clear errors.

---

### S3 Pagination & Performance Scaling

**Success Criteria**

- Library view implements pagination (server-side preferred).
- A row limit is enforced per page (e.g., 25–50).
- Searching does not require loading all records into memory.
- UI clearly indicates the total record count.

---

### S4 Organized Query Library

**Success Criteria**

At least one of:

- Queries grouped by SObject in the UI
- `Category__c` picklist field for grouping
- Collapsible sections by object
- Tag-based grouping
- Category filter component
- Utilize Salesforce Tree Grid UI Component to load the SOQL on dropdown

---

### S5 Bulk Data Handling

**Success Criteria**

At least one of:

- Documented mass-insert process using Salesforce Inspector
- Apex script for seed data
- Data Loader template
- Multi-record creation capability in the LWC

The goal is to demonstrate scalability of the solution, not necessarily build a full mass-edit UI.

---

## MVP++ Requirements (Optional)

### A1 Usage Analytics

**Success Criteria**

- Track interaction metrics (views, copies, last used).
- Provide a “most used queries” view.

---

### A2 Enhanced Object Design

**Success Criteria**

Teams extend `UsefulQuery__c` with thoughtful design enhancements such as:

- `Category__c` (Picklist)
- `Tags__c` (Text)
- `IsActive__c` (Checkbox)
- `UsageCount__c` (Number)
- `LastUsedDate__c` (DateTime)

Teams must justify additional fields in documentation.

---

### A3 Advanced UX Pattern

**Success Criteria**

- Clear separation between Browse and Create/Edit (tabs or routed view)
- Inline editing in datatable
- Modal-based editor
- Smart state handling between views

---

## Submission Checklist (What “Done” Looks Like)

- Custom Object + required fields (Name, Description, SOQL, SObject API Name)
- LWC Library + Editor
- Assisted SObject selection (MVP)
- SOQL syntax validation with safety guardrails
- Full CRUD in UI
- Permission-based access control
- Demo seed data + minimal guide

---

## Technical Resources

- [Lightning Component Library](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/components.html)
- [Lightning Design System](https://www.lightningdesignsystem.com/2e1ef8501/p/85bd85-lightning-design-system-2)
- [Apex Reference Docs](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_ref_guide.htm)
