# Development Resources

This challenge assumes general programming experience (web / Java) but not prior Salesforce experience.

The sections below provide guidance on working within the Salesforce platform and using the IDE effectively.

---

## Salesforce Platform Basics

If you are new to Salesforce, start with understanding:

- Salesforce is metadata-driven.
- Most development artifacts (objects, fields, LWCs, Apex classes) are metadata.
- Deploying changes means deploying metadata to the org.
- Salesforce enforces governor limits (resource usage limits per transaction).
- Security (CRUD, FLS, sharing) is enforced by the platform.

Recommended reading:

- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm)
- [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)

---

## Working in the IDE

You will be working inside Agentforce Vibes IDE connected to your assigned sandbox.

### Deploying Changes

When you create or modify:

- Apex classes
- Lightning Web Components
- Custom objects or fields
- Permission sets

You must deploy or sync those changes to the org using the IDE’s built-in deployment tools.

Typical workflow:

1. Create or modify metadata files in the project.
2. Use the IDE deploy/sync command.
3. Verify changes in the Salesforce UI.

If something does not appear in the UI, confirm that it has been successfully deployed.

---

## Comparing Local and Org Files

If your changes do not behave as expected:

- Compare the local project file with the org version.
- Confirm your deployment completed successfully.
- Refresh or reload metadata in the IDE if needed.

The IDE provides tools for:

- [Comparing differences](https://scribehow.com/embed/Use_SFDX_Diff_Command_in_Salesforce_Code_Builder__K879DdAxSlyb2eHKvWLUtg?as=video)
- Retrieving metadata from the org
- [Redeploying individual files](https://scribehow.com/embed/Preview_Useful_Queries_in_Salesforce_Code_Builder__iFt0sCmwQe2HHs8o148VdQ?as=video)

Use these tools rather than manually recreating components in the UI.

---

## Git/GitHub Setup (Committing and Pushing)

You will use GitHub to save your work and share changes with your teammates.

When you are ready to commit your changes (after deploying/syncing them to the org), follow this step-by-step guide:

- [How to Commit and Push Changes to GitHub from Agentforce Vibes (Scribe)](https://scribehow.com/viewer/How_to_Commit_and_Push_Changes_to_GitHub_from_Agentforce_Vibes__yAQBfOdsTSm8HqJpw21s4g)

**Tip:** Commit and push regularly (small, focused changes) to reduce merge conflicts and keep your team in sync.

---

## Creating Apex Classes

To create an Apex class:

1. Open the **Command Palette** (Ctrl/Cmd + Shift + P).
2. Select the option to create a new Apex class. "SFDX: Create Apex Class"
3. Provide a class name.
4. Write your Apex logic.
5. Deploy/sync the file.
6. Confirm it appears in **Setup → Apex Classes**.

Key Apex concepts:

- Apex is similar to Java but runs in a multi-tenant environment.
- Governor limits apply.
- Database queries use SOQL (not SQL).
- Security must be respected (CRUD/FLS and sharing).

Recommended documentation:

- [Apex Language Reference](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes.htm)
- [Apex Security and Sharing](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_security_sharing.htm)
- [Governor Limits Overview](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)

---

## Creating Lightning Web Components (LWC)

To create a Lightning Web Component:

1. Open the **Command Palette** (Ctrl/Cmd + Shift + P).
2. Select the option to create a new Lightning Web Component. "SFDX: Create Lightning Web Component"
3. Provide a component name.
4. Implement:
    - `.html`
    - `.js`
    - `.js-meta.xml`
5. Deploy/sync the component.
6. Add it to a Lightning page if required.

Key LWC concepts:

- Components are modular and reactive.
- Data can be accessed via:
  - Lightning Data Service
  - Wire adapters
  - Imperative Apex methods
- Client-side and server-side code are separated.

Recommended documentation:

- [LWC Basics](https://ergonus.sharepoint.com/:w:/s/ErgonsSalesForceSite/IQDmgYbJLvFNSJ2X7F_wxX-3Aagw3HDdDIni5W2KMlnbAzE?e=CeEAy8)
- [LWC Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [Lightning Data Service Overview](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/data_service.htm)
- [Wire Service Documentation](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.apex)

---

## Working with Custom Objects and Fields

You will need to create and modify custom objects and fields as part of this challenge (for example, `UsefulQuery__c` and its required fields).

For this challenge, you are encouraged to create objects and fields directly in the Salesforce platform UI.

---

### Creating a Custom Object (Platform UI)

1. Navigate to **Setup → Object Manager**.
2. Click **Create → Custom Object**.
3. Provide:
    - Label and Plural Label
    - Object API Name (e.g., `UsefulQuery`)
    - Record Name configuration (Text is recommended)
4. Save the object.

---

### Creating Custom Fields

1. Go to **Setup → Object Manager → Your Object**.
2. Select **Fields & Relationships**.
3. Click **New**.
4. Choose the appropriate field type (e.g., Text, Long Text Area, Picklist, Checkbox).
5. Configure:
    - Field Label
    - API Name
    - Required settings
    - Field-Level Security (FLS)
6. Add the field to page layouts.

---

### After Creating Objects and Fields

Once your objects and fields are created:

1. Retrieve the metadata into your IDE.
2. Commit changes to Git.
3. Ensure your team pulls the updated metadata before continuing development.

This ensures the org and the repository remain in sync.

---

### Important Considerations

When creating objects and fields:

- Choose field types carefully (e.g., use Long Text Area for multi-line SOQL).
- Mark required fields appropriately.
- Configure Field-Level Security.
- Assign object permissions via Permission Sets.
- Add fields to page layouts so they are visible in the UI.

You can verify all object configuration in:

**Setup → Object Manager**

---

### Documentation

- [Custom Objects and Fields Overview](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/object_reference.htm)
- [Field Types Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/field_types.htm)

## SOQL (Salesforce Object Query Language)

SOQL is used to query Salesforce data.

Important concepts:

- Queries are strongly tied to object structure.
- `LIMIT` should be used carefully.
- Unbounded queries can cause performance issues.
- SOQL is not identical to SQL.

Documentation:

- [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [Query Optimization Tips](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL_VLSQ.htm)

---

## SOQL Validation (Step 6) and Guardrails (Step 7)

A key requirement in this challenge is to **validate SOQL before saving**. The safest “beginner-friendly” way to validate is to **attempt to execute the query with strict guardrails**, and treat any `QueryException` as a validation failure.

### Recommended validation approach (execute safely)

- Try to validate by executing safely
  - If the query already has a `LIMIT`, keep it, but **cap it** (example: `LIMIT 200` becomes `LIMIT 5`)
  - If it doesn’t, either:
    - **Reject it** (“Query must include LIMIT”) — simplest and safest
    - **OR** append `LIMIT 1` for friendlier UX (but note: this slightly changes the user’s exact string)

Then:

- Run `Database.query(queryString)` inside `try/catch (QueryException e)`
- Return:
  - `isValid` (true/false)
  - `message` (exception message or “Valid”)
  - optionally an error position if you can extract it from the exception text

### Practical guardrails to enforce

Before running validation, enforce guardrails such as:

- Block dangerous keywords/patterns (examples):
  - `FOR UPDATE`
  - `ALL ROWS`
  - `WITH SYSTEM_MODE`
  - `WITH USER_MODE`
- Enforce a maximum `LIMIT` during validation (example: `LIMIT 1` or `LIMIT 5`)
- Consider rejecting queries that don’t start with `SELECT`
- Prefer validating against the selected `SObjectApiName__c` (if your UX collects it)

> Note: Salesforce does not provide a “parse-only” SOQL validator in Apex. If you call `Database.query(...)`, it will compile and execute the query — which is why the guardrails above matter.

### Example Apex pattern (simplified)

Use an Apex method that accepts the query string, enforces a limit, and returns a simple result object.

- Catch `QueryException` and return a user-friendly message.
- For preview/result-returning features, also enforce security (CRUD/FLS) before returning any records.

(See the “Practical LWC & Apex Cheat Sheet” section below for links to `Database.query`, `Schema` describe, and `Security.stripInaccessible`.)

### UX tip

A clean UX is:

1. User enters SOQL
2. User clicks **Validate**
3. UI shows “Valid” or the validation error message
4. **Save is disabled** until validation succeeds

This keeps the validation outcome unambiguous and matches the challenge requirements.

---

## Security Concepts to Understand

Salesforce enforces security at multiple levels:

- Object-level permissions (CRUD)
- Field-level security (FLS)
- Record-level sharing
- Apex `with sharing` / `without sharing`

Your solution must respect platform security rules.

Documentation:

- [Apex Security Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_keywords_sharing.htm)
- [Enforcing CRUD and FLS](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_with_security_enforced.htm)

---

## Debugging and Logs

If your Apex logic is not behaving as expected:

- Use debug logs.
- Review error messages carefully.
- Check for governor limit exceptions.
- Confirm your code is deployed and up to date.

Documentation:

- [Debug Logs Overview](https://help.salesforce.com/s/articleView?id=sf.code_debug_log.htm&type=5)

---

## Practical LWC & Apex Cheat Sheet

Below are specific LWC base components, wire adapters, and Apex helpers that are especially useful for building QueryVault.

> These are tools — not solutions. Use them to implement your own UX and server logic while respecting the guardrails in the challenge spec. Review [this doc](https://ergonus.sharepoint.com/:w:/s/ErgonsSalesForceSite/IQDmgYbJLvFNSJ2X7F_wxX-3Aagw3HDdDIni5W2KMlnbAzE?e=CeEAy8) for some LWC basics.

---

### LWC Base Components

- **`lightning-datatable`**  
  Useful for building the query library list view, including row actions (view, edit, delete, copy).

    [docs](https://developer.salesforce.com/docs/component-library/bundle/lightning-datatable/latest)

- **`lightning-combobox`**  
  Useful for SObject selection and picklist fields.

    [docs](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-combobox.html)

- **`lightning-input` / `lightning-textarea`**  
  Useful for Name, Description, and SOQL fields.

    [docs](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-input.html)

- **Toast notifications (`ShowToastEvent`)**  
  Useful for success/error messaging.

    [docs](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-platform-show-toast-event.html)

Example toast usage:

```js
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

this.dispatchEvent(
    new ShowToastEvent({
        title: 'Success',
        message: 'Query saved',
        variant: 'success'
    })
);
```

---

### LWC Wire Adapters (UI API)

- **`getObjectInfo`**  
  Useful for retrieving metadata about an SObject dynamically.

    [docs](https://developer.salesforce.com/docs/platform/lwc/guide/reference-wire-adapters-object-info.html)

- **`getPicklistValues` / `getPicklistValuesByRecordType`**  
  Useful for retrieving picklist values dynamically.

    [docs](https://developer.salesforce.com/docs/platform/lwc/guide/reference-wire-adapters-picklist-values.html)

---

### Apex Methods & Classes

- **Dynamic SOQL (`Database.query`)**  
  Useful when validating or previewing a user-provided query string.

    [docs](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dynamic_soql.htm)

Example (safe preview concept):

```java
    String safeSoql = 'SELECT Id FROM Account LIMIT 5';
    List<SObject> results = Database.query(safeSoql);
```

Always enforce a `LIMIT` and apply security checks before returning results.

---

- **Schema Describe Methods**  
  Useful for retrieving available SObjects dynamically.

    [docs](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_schema.htm)

Example:

```java
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    List<String> objectNames = new List<String>(globalDescribe.keySet());
```

---

- **Security Enforcement (`Security.stripInaccessible`)**  
  Useful for enforcing field-level security before returning records.

    [docs](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_with_security_stripInaccessible.htm)

Example:

```java
    List<SObject> raw = Database.query(safeSoql);
    SObjectAccessDecision decision =
        Security.stripInaccessible(AccessType.READABLE, raw);
    List<SObject> safeRecords = decision.getRecords();
```

---

### Useful Patterns for This Challenge

- Use `lightning-datatable` for the library list.
- Use `lightning-combobox` for SObject selection.
- Use `getObjectInfo` to avoid hardcoding object names.
- Validate SOQL server-side.
- Enforce a maximum row limit during preview.
- Respect CRUD/FLS before returning data.
- Use toast notifications for clear validation feedback.

---

### Additional Official References

- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm)
- [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [Governor Limits Overview](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)

---

## Optional Tools

For bulk data operations (MVP+):

- Salesforce Inspector (browser extension), **HIGHLY RECOMMENDED**
- Data Loader
- Anonymous Apex execution

These tools may assist with inserting or testing sample data.

---

## Final Advice

Design your solution thoughtfully:

- Keep performance in mind.
- Respect platform limits.
- Validate inputs carefully.
- Keep the user experience clean and intuitive.

Strong solutions prioritize clarity, safety, and maintainability over unnecessary complexity.

Because of the scope of this challenge and general best practices, you are strongly encouraged to break this LWC into smaller, focused subcomponents. This approach promotes separation of concerns and allows multiple team members to work in parallel more effectively.

However, this workflow can introduce coordination challenges when using Git/GitHub. To minimize conflicts, ensure that all changes are first deployed to the org. Then designate one team member to retrieve the latest metadata into their IDE (via Org Browser or “SFDX: Retrieve Source from Org”) and push those changes to GitHub. Other team members should then pull from GitHub to stay in sync.

Repeat this process regularly to reduce merge conflicts and ensure everyone is working from the most up-to-date version of the project.
