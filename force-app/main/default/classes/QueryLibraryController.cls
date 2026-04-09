/**
 * @description       : Controller methods that power the Query Vault library list,
 *                      detail loading, usage tracking, and shared object options.
 * @author            : Hackathon student team, later expanded by Ergon internal team
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 **/
public with sharing class QueryLibraryController {
    @TestVisible
    private static Set<String> forcedExceptionMethods = new Set<String>();

    /**
     * @description : Lightweight exception used to force controller failures during tests.
     **/
    private class ForcedTestException extends Exception {
    }

    /**
     * @description : Throws a forced exception for targeted test coverage scenarios.
     * @param methodName : Name of the controller method being exercised by the test.
     **/
    private static void throwForcedExceptionIfNeeded(String methodName) {
        if (Test.isRunningTest() && forcedExceptionMethods.contains(methodName)) {
            throw new ForcedTestException('Forced exception for test coverage.');
        }
    }

    /**
     * @description : Returns the list of queryable objects available to Query Vault.
     * @return List<PicklistDto> : Supported object options for the editor and filters.
     **/
    @AuraEnabled(cacheable=true)
    public static List<PicklistDto> getAvailableObjects() {
        try {
            throwForcedExceptionIfNeeded('getAvailableObjects');
            return QuickSearchWizardController.getAvailableObjects();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description : Returns the lightweight query library records shown in the main table.
     * @return UsefulQuery__c[] : Query Vault records without the full SOQL payload.
     **/
    @AuraEnabled(cacheable=true)
    public static UsefulQuery__c[] getUsefulQueries() {
        try {
            throwForcedExceptionIfNeeded('getUsefulQueries');
            UsefulQuery__c[] queries = [
                SELECT Id, Name, SObjectAPIName__c, DescriptionField__c, LastModifiedDate
                FROM UsefulQuery__c
                WITH USER_MODE
                LIMIT 50000
            ];

            return queries;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description : Loads a single Query Vault record including the stored SOQL text.
     * @param recordId : Id of the UsefulQuery__c record to retrieve.
     * @return UsefulQuery__c : Fully populated query record for edit/copy actions.
     **/
    @AuraEnabled
    public static UsefulQuery__c getQueryById(Id recordId) {
        try {
            throwForcedExceptionIfNeeded('getQueryById');
            return [
                SELECT Id, Name, SObjectAPIName__c, DescriptionField__c, SOQLField__c, LastModifiedDate
                FROM UsefulQuery__c
                WHERE Id = :recordId
                WITH USER_MODE
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description : Deletes a single Query Vault record by Id.
     * @param recordId : Id of the UsefulQuery__c record to delete.
     **/
    @AuraEnabled
    public static void deleteQuery(Id recordId) {
        try {
            throwForcedExceptionIfNeeded('deleteQuery');
            UsefulQuery__c record = [SELECT Id FROM UsefulQuery__c WHERE Id = :recordId WITH USER_MODE LIMIT 1];
            delete record;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description : Increments query usage statistics when a saved query is run or copied.
     * @param recordId : Id of the UsefulQuery__c record whose usage should be updated.
     **/
    @AuraEnabled
    public static void trackUsage(Id recordId) {
        try {
            throwForcedExceptionIfNeeded('trackUsage');
            if (
                !UsefulQuery__c.SObjectType.getDescribe().isUpdateable() ||
                !UsefulQuery__c.UsageCount__c.getDescribe().isUpdateable() ||
                !UsefulQuery__c.LastUsedDate__c.getDescribe().isUpdateable()
            ) {
                throw new AuraHandledException('Insufficient access to update query usage.');
            }

            UsefulQuery__c record = [
                SELECT Id, UsageCount__c
                FROM UsefulQuery__c
                WHERE Id = :recordId
                WITH USER_MODE
                LIMIT 1
            ];
            record.UsageCount__c = (record?.UsageCount__c ?? 0) + 1;
            record.LastUsedDate__c = DateTime.now();
            Database.update(record, AccessLevel.USER_MODE);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description : Returns the most frequently used Query Vault records for quick access.
     * @return List<UsefulQuery__c> : Top used queries ordered by descending usage count.
     **/
    @AuraEnabled
    public static List<UsefulQuery__c> getMostUsedQueries() {
        try {
            throwForcedExceptionIfNeeded('getMostUsedQueries');
            return [
                SELECT Id, Name, SObjectAPIName__c, DescriptionField__c, UsageCount__c, LastUsedDate__c
                FROM UsefulQuery__c
                WHERE UsageCount__c != NULL
                WITH USER_MODE
                ORDER BY UsageCount__c DESC
                LIMIT 10
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}