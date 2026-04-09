import { LightningElement, api, track } from 'lwc';
import { createRecord, updateRecord } from 'lightning/uiRecordApi';
import { loadStyle } from 'lightning/platformResourceLoader';
import validateSOQL from '@salesforce/apex/SoqlValidator.validateSoql';
import { ToastUtils } from 'c/toastUtils';
import dateFormatStyleFix from '@salesforce/resourceUrl/DateFormatStyleFix';

const OBJECT_API_NAME = 'UsefulQuery__c';

/**
 * @description       : Single-query creation workflow for Query Vault.
 * Handles user input for UsefulQuery__c records, validates SOQL before save,
 * and creates or updates individual saved queries from the Query Vault UI.
 * @author            : Hackathon student team, later expanded by Ergon internal team
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 *
 *  @usage
 * -> Rendered inside UsefulQueries as the single-query tab for creating or editing one saved query at a time.
 */
export default class QueryEditor extends LightningElement {
    @api recordId;
    _sObjectOptions = [];

    @api
    get sObjectOptions() {
        return this._sObjectOptions;
    }
    set sObjectOptions(value) {
        this._sObjectOptions = Array.isArray(value) ? value : [];
        this.sObjectsLoaded = true;
    }

    @track name = '';
    @track description = '';
    @track sObjectApiName = '';
    @track soql = '';

    @track isValidated = false;
    @track validationError = '';
    @track isValidating = false;

    @track sObjectsLoaded = false;

    stylesLoaded = false;

    renderedCallback() {
        if (!this.stylesLoaded) {
            this.stylesLoaded = true;
            loadStyle(this, dateFormatStyleFix).catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error loading DateFormatStyleFix:', error);
            });
        }
    }

    get isSaveDisabled() {
        return this.isValidating || !this.name?.trim() || !this.description?.trim() || !this.sObjectApiName || !this.soql?.trim();
    }

    get soqlFieldContainerClass() {
        return `date-format-fix${this.isValidated ? ' soql-field-container_valid' : ''}`;
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
        if (field === 'name') {
            this.setNameValidity('');
        }
        if (field === 'soql') {
            this.isValidated = false;
            this.validationError = '';
            this.setSoqlValidity('');
            this.setSObjectValidity('');
        }
    }

    handleSObjectChange(event) {
        this.sObjectApiName = event.detail.value;
        this.isValidated = false;
        this.validationError = '';
        this.setSObjectValidity('');
    }

    async handleValidate() {
        await this.validateSoqlField();
    }

    async handleSave() {
        if (!this.reportFormValidity()) {
            return;
        }

        const isSoqlValid = this.isValidated ? true : await this.validateSoqlField();

        if (!isSoqlValid) {
            return;
        }

        const fields = {
            Name: this.name,
            UniqueName__c: this.normalizeUniqueName(this.name),
            DescriptionField__c: this.description,
            SObjectAPIName__c: this.sObjectApiName,
            SOQLField__c: this.soql
        };

        try {
            if (this.recordId) {
                await updateRecord({ fields: { Id: this.recordId, ...fields } });
            } else {
                const result = await createRecord({ apiName: OBJECT_API_NAME, fields });
                this.recordId = result.id;
            }
            ToastUtils.showSuccessToast(this, 'Query saved successfully.');
            this.dispatchEvent(new CustomEvent('querychange'));
            this.resetForm();
        } catch (error) {
            const uniqueNameErrorMessage = this.getUniqueNameErrorMessage(error);
            this.setNameValidity(uniqueNameErrorMessage);
            if (uniqueNameErrorMessage) {
                ToastUtils.showErrorToast(this, uniqueNameErrorMessage, 'Error saving record', false);
            } else {
                ToastUtils.showErrorToast(this, error, 'Error saving record');
            }
        }
    }
    get isLoadingObjects() {
        return !this.sObjectsLoaded;
    }
    resetForm() {
        this.name = '';
        this.description = '';
        this.soql = '';
        this.sObjectApiName = '';
        this.isValidated = false;
        this.validationError = '';
        this.recordId = null;
        this.setNameValidity('');
        this.setSoqlValidity('');
    }

    reportFormValidity() {
        const inputs = this.template.querySelectorAll('lightning-input, lightning-textarea, c-searchable-combobox');
        return [...inputs].every(input => input.reportValidity());
    }

    async validateSoqlField() {
        if (!this.soql.trim()) {
            this.validationError = 'Enter a SOQL query before validating.';
            this.isValidated = false;
            this.setSoqlValidity(this.validationError);
            return false;
        }

        const sObjectMismatchMessage = this.getSObjectMismatchMessage(this.sObjectApiName, this.soql);
        if (sObjectMismatchMessage) {
            this.validationError = sObjectMismatchMessage;
            this.isValidated = false;
            this.setSObjectValidity(sObjectMismatchMessage);
            return false;
        }

        this.isValidating = true;
        this.validationError = '';
        this.isValidated = false;
        this.setSoqlValidity('');
        this.setSObjectValidity('');

        try {
            const result = await validateSOQL({ queryString: this.soql });
            if (result.isValid) {
                this.isValidated = true;
                this.validationError = '';
                this.setSoqlValidity('');
                return true;
            }

            this.isValidated = false;
            this.validationError = result.errorMessage;
            this.setSoqlValidity(result.errorMessage);
            return false;
        } catch (error) {
            this.validationError = error.body?.message || 'Validation failed.';
            this.setSoqlValidity(this.validationError);
            return false;
        } finally {
            this.isValidating = false;
        }
    }

    setSoqlValidity(message) {
        const soqlInput = this.template.querySelector('lightning-textarea[data-field="soql"]');

        if (!soqlInput) {
            return;
        }

        soqlInput.setCustomValidity(message || '');
        soqlInput.reportValidity();
    }

    setNameValidity(message) {
        const nameInput = this.template.querySelector('lightning-input[data-field="name"]');

        if (!nameInput) {
            return;
        }

        nameInput.setCustomValidity(message || '');
        nameInput.reportValidity();
    }

    setSObjectValidity(message) {
        const sObjectInput = this.template.querySelector('c-searchable-combobox');

        if (!sObjectInput) {
            return;
        }

        sObjectInput.setCustomValidity(message || '');
        sObjectInput.reportValidity();
    }

    getSObjectMismatchMessage(selectedSObjectApiName, soql) {
        const querySObjectApiName = this.extractFromObjectApiName(soql);

        if (!selectedSObjectApiName || !querySObjectApiName) {
            return '';
        }

        if (selectedSObjectApiName.toLowerCase() === querySObjectApiName.toLowerCase()) {
            return '';
        }

        return `Selected SObject API Name must match the object in the SOQL FROM clause (${querySObjectApiName}).`;
    }

    extractFromObjectApiName(soql) {
        const fromMatch = soql?.match(/\bfrom\s+([a-zA-Z0-9_]+)/i);
        return fromMatch ? fromMatch[1] : '';
    }

    normalizeUniqueName(name) {
        return name?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
    }

    getUniqueNameErrorMessage(error) {
        const fieldError = error?.body?.output?.fieldErrors?.UniqueName__c?.[0]?.message;
        const outputErrors = error?.body?.output?.errors || [];
        const pageError = error?.body?.output?.pageErrors?.[0]?.message;
        const bodyMessage = error?.body?.message;
        const topLevelMessage = error?.message;
        const serializedError = JSON.stringify(error);
        const candidateMessages = [
            fieldError,
            ...outputErrors.map(outputError => outputError?.message),
            pageError,
            bodyMessage,
            topLevelMessage,
            serializedError
        ].filter(Boolean);

        for (const message of candidateMessages) {
            if (message.includes('UniqueName__c') || message.includes('duplicate value') || message.includes('DUPLICATE_VALUE')) {
                return 'A query with this name already exists.';
            }
        }

        for (const outputError of outputErrors) {
            if (outputError?.errorCode === 'DUPLICATE_VALUE') {
                return 'A query with this name already exists.';
            }
        }

        return '';
    }
}