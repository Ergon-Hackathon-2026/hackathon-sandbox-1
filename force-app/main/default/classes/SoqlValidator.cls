/**
 * @description       : Validation and save services for Query Vault SOQL workflows.
 * Handles single-query validation, query preview, individual query save logic,
 * and bulk upload validation/create processing for UsefulQuery__c records.
 * @author            : Hackathon student team, later expanded by Ergon internal team
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 */
public with sharing class SoqlValidator {
    private static final Integer VALIDATION_LIMIT = 5;
    private static final Integer MAX_BULK_UPLOAD_ROWS = 50;

    private static final List<String> INVALIDATED_FIELDS = new List<String>{ 'FOR UPDATE', 'ALL ROWS', 'WITH SYSTEM_MODE', 'WITH USER_MODE' };

    /**
     * @description       : Response envelope returned to the LWC after validating a single SOQL query.
     */
    public class ValidationResult {
        @AuraEnabled
        public Boolean isValid;
        @AuraEnabled
        public String errorMessage;
        @AuraEnabled
        public String query;

        public ValidationResult(Boolean isValid, String errorMessage, String query) {
            this.isValid = isValid;
            this.errorMessage = errorMessage;
            this.query = query;
        }
    }

    /**
     * @description       : Client-supplied bulk upload row used by the Query Vault bulk upload flow.
     */
    public class BulkQueryUploadRow {
        @AuraEnabled
        public Integer rowNumber { get; set; }
        @AuraEnabled
        public String name { get; set; }
        @AuraEnabled
        public String description { get; set; }
        @AuraEnabled
        public String sObjectApiName { get; set; }
        @AuraEnabled
        public String soql { get; set; }
    }

    /**
     * @description       : Per-row result returned after bulk validation and partial insert processing.
     */
    public class BulkQueryUploadRowResult {
        @AuraEnabled
        public Integer rowNumber { get; set; }
        @AuraEnabled
        public String name { get; set; }
        @AuraEnabled
        public Boolean success { get; set; }
        @AuraEnabled
        public String message { get; set; }
        @AuraEnabled
        public Id recordId { get; set; }

        public BulkQueryUploadRowResult(Integer rowNumber, String name, Boolean success, String message, Id recordId) {
            this.rowNumber = rowNumber;
            this.name = name;
            this.success = success;
            this.message = message;
            this.recordId = recordId;
        }
    }

    /**
     * @description       : Aggregate bulk upload response returned to the LWC after processing all rows.
     */
    public class BulkQueryUploadResult {
        @AuraEnabled
        public Integer createdCount { get; set; }
        @AuraEnabled
        public Integer rejectedCount { get; set; }
        @AuraEnabled
        public List<BulkQueryUploadRowResult> rowResults { get; set; }

        public BulkQueryUploadResult(Integer createdCount, Integer rejectedCount, List<BulkQueryUploadRowResult> rowResults) {
            this.createdCount = createdCount;
            this.rejectedCount = rejectedCount;
            this.rowResults = rowResults;
        }
    }

    /**
     * @description       : Internal helper object for lightweight SOQL syntax prechecks before execution.
     */
    private class QueryPrecheckResult {
        Boolean isValid;
        String errorMessage;

        QueryPrecheckResult(Boolean isValid, String errorMessage) {
            this.isValid = isValid;
            this.errorMessage = errorMessage;
        }
    }

    /**
     * @description       : Validates a single SOQL query string and returns a structured response for the UI.
     * Applies lightweight syntax prechecks, blocks unsupported clauses, and executes a capped query to confirm validity.
     * @param queryString The raw SOQL string entered by the user.
     * @return ValidationResult indicating whether the query is valid and any associated message.
     */
    @AuraEnabled
    public static ValidationResult validateSoql(String queryString) {
        if (String.isBlank(queryString)) {
            return new ValidationResult(false, 'Query cannot be blank.', null);
        }
        String trimmed = queryString.trim();
        if (!trimmed.toUpperCase().startsWith('SELECT')) {
            return new ValidationResult(false, 'Query must begin with SELECT.', null);
        }
        String upperQuery = trimmed.toUpperCase();
        for (String pattern : INVALIDATED_FIELDS) {
            if (upperQuery.contains(pattern)) {
                return new ValidationResult(false, 'Query cannot contain: ' + pattern + ', Remove and try again.', null);
            }
        }

        QueryPrecheckResult precheck = precheckQuery(trimmed);
        if (!precheck.isValid) {
            return new ValidationResult(false, precheck.errorMessage, null);
        }

        // add limit if missing, cap if present
        String safeQuery;
        Pattern limitPattern = Pattern.compile('(?i)\\bLIMIT\\s+(\\d+)');
        Matcher limitMatcher = limitPattern.matcher(trimmed);
        if (limitMatcher.find()) {
            Integer existingLimit = Integer.valueOf(limitMatcher.group(1));
            Integer capLimit = Math.min(existingLimit, VALIDATION_LIMIT);
            safeQuery = trimmed.replaceAll('(?i)\\bLIMIT\\s+\\d+', 'LIMIT ' + capLimit);
        } else {
            // no limit found, add one automatically
            safeQuery = trimmed + ' LIMIT ' + VALIDATION_LIMIT;
        }

        try {
            List<SObject> results = Database.queryWithBinds(safeQuery, new Map<String, Object>(), AccessLevel.USER_MODE);
            return new ValidationResult(
                true,
                'Query is valid. Returned ' + results.size() + ' records (capped at ' + VALIDATION_LIMIT + ').',
                safeQuery
            );
        } catch (QueryException e) {
            return new ValidationResult(false, normalizeQueryErrorMessage(e.getMessage()), null);
        } catch (Exception e) {
            return new ValidationResult(false, 'Unexpected Error: ' + e.getMessage(), null);
        }
    }

    /**
     * @description       : Creates a single UsefulQuery__c record from the legacy save flow.
     * @param name The user-facing query name.
     * @param description The query description shown in Query Vault.
     * @param soqlQuery The validated SOQL text to persist.
     * @param sObjectApiName The selected SObject API name associated with the query.
     * @return String Id of the created UsefulQuery__c record.
     */
    @AuraEnabled
    public static String saveQuery(String name, String description, String soqlQuery, String sObjectApiName) {
        try {
            assertUsefulQueryCreateAccess();
            UsefulQuery__c record = new UsefulQuery__c();
            record.Name = name;
            record.UniqueName__c = normalizeUniqueName(name);
            record.DescriptionField__c = description;
            record.SOQLField__c = soqlQuery;
            record.SObjectAPIName__c = sObjectApiName;
            Database.insert(record, AccessLevel.USER_MODE);
            return record.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description       : Validates and inserts a batch of uploaded UsefulQuery__c rows with partial success behavior.
     * @param rows Parsed bulk upload rows from the Query Vault bulk upload UI.
     * @return BulkQueryUploadResult containing created/rejected counts and per-row results.
     */
    @AuraEnabled
    public static BulkQueryUploadResult bulkSaveQueries(List<BulkQueryUploadRow> rows) {
        try {
            assertUsefulQueryCreateAccess();
            if (rows == null || rows.isEmpty()) {
                throw new AuraHandledException('At least one row is required.');
            }

            if (rows.size() > MAX_BULK_UPLOAD_ROWS) {
                throw new AuraHandledException('Bulk upload is limited to 50 rows at a time.');
            }

            List<BulkQueryUploadRowResult> rowResults = new List<BulkQueryUploadRowResult>();
            List<UsefulQuery__c> recordsToInsert = new List<UsefulQuery__c>();
            List<Integer> insertRowIndexes = new List<Integer>();

            Set<String> normalizedNames = new Set<String>();
            Map<String, Integer> firstRowByNormalizedName = new Map<String, Integer>();
            Set<String> duplicateNamesInUpload = new Set<String>();

            for (BulkQueryUploadRow row : rows) {
                String normalizedName = normalizeUniqueName(row?.name);
                if (String.isBlank(normalizedName)) {
                    continue;
                }

                if (firstRowByNormalizedName.containsKey(normalizedName)) {
                    duplicateNamesInUpload.add(normalizedName);
                } else {
                    firstRowByNormalizedName.put(normalizedName, row.rowNumber);
                    normalizedNames.add(normalizedName);
                }
            }

            Set<String> existingNames = new Set<String>();
            if (!normalizedNames.isEmpty()) {
                for (UsefulQuery__c existingRecord : [
                    SELECT UniqueName__c
                    FROM UsefulQuery__c
                    WHERE UniqueName__c IN :normalizedNames
                    WITH USER_MODE
                ]) {
                    existingNames.add(existingRecord.UniqueName__c);
                }
            }

            for (BulkQueryUploadRow row : rows) {
                String rowName = row?.name;
                String normalizedName = normalizeUniqueName(rowName);
                String validationMessage = validateBulkRow(row, normalizedName, duplicateNamesInUpload, existingNames);

                if (String.isNotBlank(validationMessage)) {
                    rowResults.add(new BulkQueryUploadRowResult(row.rowNumber, rowName, false, validationMessage, null));
                    continue;
                }

                recordsToInsert.add(buildUsefulQueryRecord(row));
                insertRowIndexes.add(rowResults.size());
                rowResults.add(new BulkQueryUploadRowResult(row.rowNumber, rowName, true, 'Ready to create.', null));
            }

            if (!recordsToInsert.isEmpty()) {
                Database.SaveResult[] saveResults = Database.insert(recordsToInsert, false, AccessLevel.USER_MODE);
                for (Integer index = 0; index < saveResults.size(); index++) {
                    Integer resultIndex = insertRowIndexes[index];
                    Database.SaveResult saveResult = saveResults[index];

                    if (saveResult.isSuccess()) {
                        rowResults[resultIndex].recordId = saveResult.getId();
                        rowResults[resultIndex].message = 'Created successfully.';
                    } else {
                        rowResults[resultIndex].success = false;
                        rowResults[resultIndex].message = normalizeDmlErrorMessage(saveResult.getErrors());
                    }
                }
            }

            Integer createdCount = 0;
            Integer rejectedCount = 0;
            for (BulkQueryUploadRowResult rowResult : rowResults) {
                if (rowResult.success) {
                    createdCount++;
                } else {
                    rejectedCount++;
                }
            }

            return new BulkQueryUploadResult(createdCount, rejectedCount, rowResults);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description       : Ensures the running user can create Query Vault records and populate required fields.
     */
    private static void assertUsefulQueryCreateAccess() {
        if (
            !UsefulQuery__c.SObjectType.getDescribe().isCreateable() ||
            !UsefulQuery__c.Name.getDescribe().isCreateable() ||
            !UsefulQuery__c.UniqueName__c.getDescribe().isCreateable() ||
            !UsefulQuery__c.DescriptionField__c.getDescribe().isCreateable() ||
            !UsefulQuery__c.SOQLField__c.getDescribe().isCreateable() ||
            !UsefulQuery__c.SObjectAPIName__c.getDescribe().isCreateable()
        ) {
            throw new AuraHandledException('Insufficient access to create queries.');
        }
    }

    /**
     * @description       : Normalizes a query name for uniqueness checks and UniqueName__c storage.
     * @param name Raw user-entered query name.
     * @return String trimmed, whitespace-normalized, lowercase name value.
     */
    private static String normalizeUniqueName(String name) {
        if (String.isBlank(name)) {
            return null;
        }

        return name.trim().replaceAll('\\s+', ' ').toLowerCase();
    }

    /**
     * @description       : Builds a UsefulQuery__c record from a validated bulk upload row.
     * @param row Parsed bulk upload row.
     * @return UsefulQuery__c record ready for insert.
     */
    private static UsefulQuery__c buildUsefulQueryRecord(BulkQueryUploadRow row) {
        UsefulQuery__c record = new UsefulQuery__c();
        record.Name = row.name;
        record.UniqueName__c = normalizeUniqueName(row.name);
        record.DescriptionField__c = row.description;
        record.SOQLField__c = row.soql;
        record.SObjectAPIName__c = row.sObjectApiName;
        return record;
    }

    /**
     * @description       : Validates one bulk-upload row against required fields, uniqueness rules, object checks, and SOQL validity.
     * @param row The parsed bulk upload row to validate.
     * @param normalizedName The row name normalized for uniqueness comparisons.
     * @param duplicateNamesInUpload Set of duplicate normalized names found in the current upload payload.
     * @param existingNames Set of normalized names already stored in Salesforce.
     * @return String validation message when invalid, otherwise null.
     */
    private static String validateBulkRow(
        BulkQueryUploadRow row,
        String normalizedName,
        Set<String> duplicateNamesInUpload,
        Set<String> existingNames
    ) {
        if (row == null) {
            return 'Row data is missing.';
        }

        if (String.isBlank(row.name)) {
            return 'Name is required.';
        }

        if (String.isBlank(row.description)) {
            return 'Description is required.';
        }

        if (String.isBlank(row.sObjectApiName)) {
            return 'SObject API Name is required.';
        }

        if (!isAvailableSObject(row.sObjectApiName)) {
            return 'SObject API Name must be an SObject available in the org.';
        }

        if (String.isBlank(row.soql)) {
            return 'SOQL is required.';
        }

        if (duplicateNamesInUpload.contains(normalizedName)) {
            return 'A query with this name appears more than once in the upload.';
        }

        if (existingNames.contains(normalizedName)) {
            return 'A query with this name already exists.';
        }

        String sObjectMismatchMessage = getSObjectMismatchMessage(row.sObjectApiName, row.soql);
        if (String.isNotBlank(sObjectMismatchMessage)) {
            return sObjectMismatchMessage;
        }

        ValidationResult validationResult = validateSoql(row.soql);
        if (!validationResult.isValid) {
            return validationResult.errorMessage;
        }

        return null;
    }

    /**
     * @description       : Determines whether the supplied SObject API name is queryable, accessible, and valid for Query Vault.
     * @param sObjectApiName Candidate SObject API name from the UI.
     * @return Boolean true when the object can be used in Query Vault queries.
     */
    private static Boolean isAvailableSObject(String sObjectApiName) {
        if (String.isBlank(sObjectApiName)) {
            return false;
        }

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        if (!globalDescribe.containsKey(sObjectApiName)) {
            return false;
        }

        Schema.DescribeSObjectResult describeResult = globalDescribe.get(sObjectApiName).getDescribe();
        if (!describeResult.isQueryable() || !describeResult.isAccessible() || describeResult.isDeprecatedAndHidden()) {
            return false;
        }

        for (String suffix : new List<String>{ 'History', 'Share', 'Feed', 'ChangeEvent' }) {
            if (describeResult.getName().endsWith(suffix)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @description       : Compares the selected SObject API name to the SOQL FROM-clause object and returns a friendly mismatch message.
     * @param selectedSObjectApiName The SObject chosen in the UI.
     * @param soql The SOQL string being validated.
     * @return String mismatch message when objects differ, otherwise null.
     */
    private static String getSObjectMismatchMessage(String selectedSObjectApiName, String soql) {
        String querySObjectApiName = extractFromObjectApiName(soql);

        if (String.isBlank(selectedSObjectApiName) || String.isBlank(querySObjectApiName)) {
            return null;
        }

        if (selectedSObjectApiName.toLowerCase() == querySObjectApiName.toLowerCase()) {
            return null;
        }

        return 'Selected SObject API Name must match the object in the SOQL FROM clause (' + querySObjectApiName + ').';
    }

    /**
     * @description       : Extracts the top-level object API name from a SOQL FROM clause.
     * @param soql SOQL string to inspect.
     * @return String object API name when present, otherwise null.
     */
    private static String extractFromObjectApiName(String soql) {
        if (String.isBlank(soql)) {
            return null;
        }

        Matcher fromMatcher = Pattern.compile('(?i)\\bfrom\\s+([a-zA-Z0-9_]+)').matcher(soql);
        return fromMatcher.find() ? fromMatcher.group(1) : null;
    }

    /**
     * @description       : Normalizes DML error messages returned during bulk insert processing.
     * @param errors SaveResult error array returned by Database.insert.
     * @return String user-friendly error message for the row.
     */
    private static String normalizeDmlErrorMessage(Database.Error[] errors) {
        if (errors == null || errors.size() == 0) {
            return 'Unable to create query.';
        }

        for (Database.Error error : errors) {
            String errorMessage = error?.getMessage();
            if (String.isBlank(errorMessage)) {
                continue;
            }

            if (errorMessage.contains('UniqueName__c') || errorMessage.contains('duplicate value')) {
                return 'A query with this name already exists.';
            }
        }

        return errors[0].getMessage();
    }

    /**
     * @description       : Executes a capped preview version of a SOQL query and returns the resulting rows.
     * @param queryString Raw SOQL string supplied by the UI.
     * @return List<SObject> up to the preview limit of matching rows.
     */
    @AuraEnabled
    public static List<SObject> previewQuery(String queryString) {
        if (String.isBlank(queryString)) {
            throw new AuraHandledException('Query cannot be blank.');
        }
        String trimmed = queryString.trim();
        if (!trimmed.toUpperCase().startsWith('SELECT')) {
            throw new AuraHandledException('Query must begin with SELECT.');
        }

        QueryPrecheckResult precheck = precheckQuery(trimmed);
        if (!precheck.isValid) {
            throw new AuraHandledException(precheck.errorMessage);
        }

        // add limit if missing, cap if present
        String safeQuery;
        Pattern limitPattern = Pattern.compile('(?i)\\bLIMIT\\s+(\\d+)');
        Matcher limitMatcher = limitPattern.matcher(trimmed);
        if (limitMatcher.find()) {
            Integer capLimit = Math.min(Integer.valueOf(limitMatcher.group(1)), 5);
            safeQuery = trimmed.replaceAll('(?i)\\bLIMIT\\s+\\d+', 'LIMIT ' + capLimit);
        } else {
            safeQuery = trimmed + ' LIMIT 5';
        }

        try {
            return Database.queryWithBinds(safeQuery, new Map<String, Object>(), AccessLevel.USER_MODE);
        } catch (Exception e) {
            throw new AuraHandledException(normalizeQueryErrorMessage(e.getMessage()));
        }
    }

    /**
     * @description       : Performs lightweight syntax checks before the platform query parser is invoked.
     * @param trimmedQuery Trimmed SOQL string.
     * @return QueryPrecheckResult indicating whether validation can continue.
     */
    private static QueryPrecheckResult precheckQuery(String trimmedQuery) {
        String upperQuery = trimmedQuery.toUpperCase();

        if (Pattern.compile('(?i)\\bFROM\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Add an object name after FROM.');
        }
        if (Pattern.compile('(?i)\\bWHERE\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Finish the WHERE clause.');
        }
        if (Pattern.compile('(?i)\\bORDER\\s*$|\\bORDER\\s+BY\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Finish the ORDER BY clause.');
        }
        if (Pattern.compile('(?i)\\bGROUP\\s*$|\\bGROUP\\s+BY\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Finish the GROUP BY clause.');
        }
        if (Pattern.compile('(?i)\\bHAVING\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Finish the HAVING clause.');
        }
        if (Pattern.compile('(?i)\\bLIMIT\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Add a number after LIMIT.');
        }
        if (Pattern.compile('(?i)\\bOFFSET\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Add a number after OFFSET.');
        }
        if (Pattern.compile('(?i)\\bAND\\s*$|\\bOR\\s*$').matcher(trimmedQuery).find()) {
            return new QueryPrecheckResult(false, 'SOQL Error: Finish the filter condition.');
        }

        Matcher trailingWordMatcher = Pattern.compile('(?i)\\b([A-Z]+)\\s*$').matcher(upperQuery);
        if (trailingWordMatcher.find()) {
            String trailingWord = trailingWordMatcher.group(1);
            for (String clauseKeyword : new List<String>{ 'SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AND', 'OR' }) {
                if (clauseKeyword.startsWith(trailingWord) && clauseKeyword != trailingWord && trailingWord.length() >= 2) {
                    return new QueryPrecheckResult(false, 'SOQL Error: Finish the ' + clauseKeyword + ' clause.');
                }
            }
        }

        return new QueryPrecheckResult(true, null);
    }

    /**
     * @description       : Converts verbose platform query exceptions into shorter UI-friendly validation messages.
     * @param rawMessage Raw exception message from query execution.
     * @return String normalized SOQL error message for display in the UI.
     */
    private static String normalizeQueryErrorMessage(String rawMessage) {
        if (String.isBlank(rawMessage)) {
            return 'SOQL Error: Query is invalid.';
        }

        String message = rawMessage.trim();

        if (message.startsWith('No such column')) {
            Integer firstPeriodIndex = message.indexOf('.');
            if (firstPeriodIndex > 0) {
                message = message.substring(0, firstPeriodIndex + 1);
            }
        }

        return 'SOQL Error: ' + message;
    }
}