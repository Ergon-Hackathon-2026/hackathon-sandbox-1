import { api, LightningElement, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { NavigationMixin } from 'lightning/navigation';
import getQueryById from '@salesforce/apex/QueryLibraryController.getQueryById';
import validateSoql from '@salesforce/apex/SoqlValidator.validateSoql';
import deleteQuery from '@salesforce/apex/QueryLibraryController.deleteQuery';
import { updateRecord } from 'lightning/uiRecordApi';
import previewQuery from '@salesforce/apex/SoqlValidator.previewQuery';
import trackUsage from '@salesforce/apex/QueryLibraryController.trackUsage';
import { ToastUtils } from 'c/toastUtils';
import ConfirmationModal from 'c/confirmationModal';
import dateFormatStyleFix from '@salesforce/resourceUrl/DateFormatStyleFix';
import fuseResource from '@salesforce/resourceUrl/Fuse';

// how long to wait after the user stops typing before searching
const DEBOUNCE_DELAY = 300;

// defines the columns shown in the main table
const COLUMNS = [
    {
        label: 'Name',
        fieldName: 'Name',
        type: 'button',
        sortable: true,
        typeAttributes: {
            label: { fieldName: 'Name' },
            name: 'view_soql',
            variant: 'base'
        }
    },
    { label: 'SObject', fieldName: 'SObjectAPIName__c', type: 'text', sortable: true },
    { label: 'Description', fieldName: 'DescriptionField__c', type: 'text', wrapText: true },
    {
        label: 'Last Modified',
        fieldName: 'LastModifiedDate',
        type: 'date',
        sortable: true,
        typeAttributes: {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [
                { label: 'View SOQL', name: 'view_soql', iconName: 'utility:apex_alt' },
                { label: 'Copy SOQL', name: 'copy_soql', iconName: 'utility:copy' },
                { label: 'Edit', name: 'edit', iconName: 'utility:edit' },
                { label: 'Delete', name: 'delete', iconName: 'utility:delete' }
            ]
        }
    }
];

/**
 * @description       : Query library and management experience for Query Vault.
 * Displays saved UsefulQuery__c records with client-side search, filtering, sorting,
 * grouped views, inline validation, preview results, and edit/delete actions.
 * @author            : Hackathon student team, later expanded by Ergon internal team
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 *
 *  @usage
 * -> Rendered inside UsefulQueries to browse, inspect, validate, preview, edit, and delete saved query records.
 */
export default class QueryLibrary extends NavigationMixin(LightningElement) {
    _records = [];
    _availableSObjectOptions = [];
    fuse;
    fuseLoaded = false;
    hasFuseLoadStarted = false;

    @api
    get records() {
        return this._records;
    }
    set records(value) {
        this._records = Array.isArray(value) ? [...value] : [];
        this.syncSObjectOptions();
        this.initializeFuse();
        this.loadQueries();
    }

    @api
    get availableSObjectOptions() {
        return this._availableSObjectOptions;
    }
    set availableSObjectOptions(value) {
        this._availableSObjectOptions = Array.isArray(value) ? [...value] : [];
        this.syncSObjectOptions();
    }

    // rows currently shown in the table
    @track displayedRows = [];
    @track filteredRows = [];
    // options for the sobject filter dropdown
    @track sobjectOptions = [];

    // loading and error state for the main table
    @api isLoading = false;
    @track isLoadingSoql = false;
    @track hasError = false;
    @track errorMessage = '';

    // page size tracker
    @track pageSize = 10;

    // controls whether the view modal is open and which record is selected
    @track isModalOpen = false;
    @track selectedRecord = {};

    // total number of records matching the current search and filter
    @track totalRecordCount = 0;

    // validation state for the view modal
    @track isValidating = false;
    @track validationResult = null;
    @track showValidation = false;

    // edit modal state
    @track isEditModalOpen = false;
    @track editRecord = {};
    @track editIsValidated = false;
    @track editValidationError = '';
    @track editIsValidating = false;

    // preview modal state
    @track previewRows = [];
    @track previewColumns = [];
    @track isPreviewOpen = false;
    @track isPreviewLoading = false;
    @track previewError = '';

    // grouped sObject variable
    @track isGroupedView = false;

    // current search and filter values
    searchTerm = '';
    selectedSObject = '';
    sortedBy = 'Name';
    sortedDirection = 'asc';
    currentPage = 1;
    columns = COLUMNS;

    _searchDebounceTimer = null;
    stylesLoaded = false;

    renderedCallback() {
        if (!this.stylesLoaded) {
            this.stylesLoaded = true;
            loadStyle(this, dateFormatStyleFix).catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error loading DateFormatStyleFix:', error);
            });
        }

        if (!this.fuseLoaded && !this.hasFuseLoadStarted) {
            this.hasFuseLoadStarted = true;
            loadScript(this, fuseResource)
                .then(() => {
                    this.fuseLoaded = true;
                    this.initializeFuse();
                    this.loadQueries();
                })
                .catch(error => {
                    this.hasFuseLoadStarted = false;
                    // eslint-disable-next-line no-console
                    console.error('Error loading Fuse.js', error);
                });
        }
    }

    // runs when the component is removed from the page
    // clears the search timer
    disconnectedCallback() {
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }
    }

    // filters, sorts, and paginates the in-memory record set for the current table view
    loadQueries() {
        let filteredRows = [...this.records];

        if (this.selectedSObject) {
            filteredRows = filteredRows.filter(row => row.SObjectAPIName__c === this.selectedSObject);
        }

        const normalizedSearchTerm = (this.searchTerm || '').trim();
        if (normalizedSearchTerm) {
            if (this.fuse) {
                filteredRows = this.fuse.search(normalizedSearchTerm, { limit: filteredRows.length }).map(result => result.item);

                if (this.selectedSObject) {
                    filteredRows = filteredRows.filter(row => row.SObjectAPIName__c === this.selectedSObject);
                }
            } else {
                const loweredSearchTerm = normalizedSearchTerm.toLowerCase();
                filteredRows = filteredRows.filter(row => {
                    const name = row.Name?.toLowerCase() || '';
                    const description = row.DescriptionField__c?.toLowerCase() || '';
                    const sObject = row.SObjectAPIName__c?.toLowerCase() || '';
                    return name.includes(loweredSearchTerm) || description.includes(loweredSearchTerm) || sObject.includes(loweredSearchTerm);
                });
            }
        }

        filteredRows.sort((firstRow, secondRow) => {
            const firstValue = this.getSortableValue(firstRow[this.sortedBy]);
            const secondValue = this.getSortableValue(secondRow[this.sortedBy]);

            if (firstValue < secondValue) {
                return this.sortedDirection === 'desc' ? 1 : -1;
            }
            if (firstValue > secondValue) {
                return this.sortedDirection === 'desc' ? -1 : 1;
            }
            return 0;
        });

        this.filteredRows = filteredRows;
        this.totalRecordCount = filteredRows.length;

        const maxPage = Math.max(1, Math.ceil(this.totalRecordCount / this.pageSize));
        if (this.currentPage > maxPage) {
            this.currentPage = maxPage;
        }

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        this.displayedRows = filteredRows.slice(startIndex, endIndex);
    }

    initializeFuse() {
        if (!this.fuseLoaded || typeof Fuse === 'undefined') {
            return;
        }

        this.fuse = new Fuse(this.records, {
            keys: ['Name', 'DescriptionField__c', 'SObjectAPIName__c'],
            includeScore: true,
            threshold: 0.3,
            ignoreLocation: true
        });
    }

    syncSObjectOptions() {
        const objectLabelsByApiName = new Map(this.availableSObjectOptions.map(option => [option.value, option.label]));

        const usedObjectApiNames = [...new Set(this.records.map(record => record.SObjectAPIName__c).filter(Boolean))].sort((first, second) =>
            first.localeCompare(second)
        );

        this.sobjectOptions = usedObjectApiNames.map(objectApiName => ({
            label: objectLabelsByApiName.get(objectApiName) || objectApiName,
            value: objectApiName,
            description: objectApiName
        }));
    }

    // loads the full record including the soql field when the user opens the view modal
    loadFullRecord(recordId) {
        this.isLoadingSoql = true;
        return getQueryById({ recordId })
            .then(data => {
                this.selectedRecord = { ...this.selectedRecord, ...data };
                return data;
            })
            .catch(error => {
                this.selectedRecord = {
                    ...this.selectedRecord,
                    SOQLField__c: `Error loading SOQL: ${this._extractError(error)}`
                };
                throw error;
            })
            .finally(() => {
                this.isLoadingSoql = false;
            });
    }

    // resets to page 1 and reloads when filters or sort change
    applyFiltersAndSort() {
        this.currentPage = 1;
        this.loadQueries();
    }

    // handles column header clicks to sort the table
    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
        this.currentPage = 1;
        this.loadQueries();
    }

    // debounces search input before reapplying the client-side filter set
    handleSearchChange(event) {
        const value = event.target.value;
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }
        this._searchDebounceTimer = setTimeout(() => {
            this.searchTerm = value;
            this.applyFiltersAndSort();
        }, DEBOUNCE_DELAY);
    }

    // applies the selected SObject filter to the current in-memory record set
    handleSObjectChange(event) {
        this.selectedSObject = event.detail.value;
        this.applyFiltersAndSort();
    }

    // goes to the previous page
    goToPrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadQueries();
        }
    }

    // goes to the next page
    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadQueries();
        }
    }

    // routes datatable row actions to modal, copy, edit, or delete flows
    async handleRowAction(event) {
        const { name } = event.detail.action;
        const row = event.detail.row;

        if (name === 'view_soql') {
            this.openModal(row);
        } else if (name === 'copy_soql') {
            try {
                const record = await this.loadFullRecord(row.Id);
                await this.copyTextToClipboard(record?.SOQLField__c || '');
                ToastUtils.showSuccessToast(this, 'SOQL copied to clipboard.', 'Copied');
            } catch (error) {
                ToastUtils.showErrorToast(this, error, 'Copy Failed', false);
            }
        } else if (name === 'edit') {
            this.selectedRecord = { ...row };
            this.editIsValidated = false;
            this.editValidationError = '';
            this.isModalOpen = false;
            this.isEditModalOpen = false;

            getQueryById({ recordId: row.Id })
                .then(data => {
                    this.editRecord = {
                        Id: data.Id,
                        Name: data.Name,
                        DescriptionField__c: data.DescriptionField__c,
                        SObjectAPIName__c: data.SObjectAPIName__c,
                        SOQLField__c: data.SOQLField__c
                    };
                    this.isEditModalOpen = true;
                })
                .catch(error => {
                    ToastUtils.showErrorToast(this, error, 'Error');
                });
        } else if (name === 'delete') {
            this.selectedRecord = { ...row };
            this.handleDeleteClick();
        }
    }

    // opens the view modal and loads the full record
    openModal(row) {
        this.isEditModalOpen = false;
        this.selectedRecord = { ...row };
        this.isModalOpen = true;
        this.validationResult = null;
        this.showValidation = false;
        this.loadFullRecord(row.Id);
        trackUsage({ recordId: row.Id });
    }

    // closes the view modal and refreshes the table
    closeModal() {
        this.isModalOpen = false;
        this.selectedRecord = {};
        this.validationResult = null;
        this.showValidation = false;
        this.isPreviewOpen = false;
        this.previewRows = [];
        this.previewColumns = [];
        this.previewError = '';
        this.loadQueries();
    }

    // copies the SOQL currently loaded in the detail modal and tracks usage
    async copySoql() {
        try {
            await this.copyTextToClipboard(this.selectedRecord.SOQLField__c || '');
            ToastUtils.showSuccessToast(this, 'SOQL copied to clipboard.', 'Copied');
        } catch (error) {
            ToastUtils.showErrorToast(this, error, 'Copy Failed', false);
        }
        trackUsage({ recordId: this.selectedRecord.Id });
    }

    // resets edit validation state whenever the user changes a field in the edit modal
    handleEditFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.detail.value !== undefined ? event.detail.value : event.target.value;
        this.editRecord = { ...this.editRecord, [field]: value };
        this.editIsValidated = false;
        this.editValidationError = '';

        if (field === 'Name') {
            this.setEditNameValidity('');
        }

        if (field === 'SOQLField__c') {
            this.setEditSoqlValidity('');
            this.setEditSObjectValidity('');
        }

        if (field === 'SObjectAPIName__c') {
            this.setEditSObjectValidity('');
        }
    }

    // validates the edited SOQL before allowing the record to be saved
    async handleEditValidate() {
        if (!this.editRecord.SOQLField__c?.trim()) {
            this.editValidationError = 'Enter a SOQL query before validating.';
            this.setEditSoqlValidity(this.editValidationError);
            return;
        }

        const sObjectMismatchMessage = this.getSObjectMismatchMessage(this.editRecord.SObjectAPIName__c, this.editRecord.SOQLField__c);
        if (sObjectMismatchMessage) {
            this.editValidationError = sObjectMismatchMessage;
            this.editIsValidated = false;
            this.setEditSObjectValidity(sObjectMismatchMessage);
            return;
        }

        this.editIsValidating = true;
        this.editValidationError = '';
        this.editIsValidated = false;
        this.setEditSoqlValidity('');
        this.setEditSObjectValidity('');
        try {
            const result = await validateSoql({ queryString: this.editRecord.SOQLField__c });
            if (result.isValid) {
                this.editIsValidated = true;
                this.editValidationError = '';
                this.setEditSoqlValidity('');
            } else {
                this.editValidationError = result.errorMessage;
                this.setEditSoqlValidity(result.errorMessage);
            }
        } catch (error) {
            this.editValidationError = error.body?.message || 'Validation failed.';
            this.setEditSoqlValidity(this.editValidationError);
        } finally {
            this.editIsValidating = false;
        }
    }

    // saves the edited record only after the SOQL has passed validation
    async handleEditSave() {
        if (!this.editIsValidated) {
            ToastUtils.showWarningToast(this, 'Validate SOQL before saving.', 'Validate First');
            return;
        }
        try {
            await updateRecord({
                fields: {
                    Id: this.editRecord.Id,
                    Name: this.editRecord.Name,
                    UniqueName__c: this.normalizeUniqueName(this.editRecord.Name),
                    DescriptionField__c: this.editRecord.DescriptionField__c,
                    SObjectAPIName__c: this.editRecord.SObjectAPIName__c,
                    SOQLField__c: this.editRecord.SOQLField__c
                }
            });
            ToastUtils.showSuccessToast(this, 'Query updated successfully.', 'Saved');
            this.isEditModalOpen = false;
            this.closeModal();
            this.dispatchEvent(new CustomEvent('querychange'));
        } catch (error) {
            const uniqueNameErrorMessage = this.getUniqueNameErrorMessage(error);
            this.setEditNameValidity(uniqueNameErrorMessage);
            if (uniqueNameErrorMessage) {
                ToastUtils.showErrorToast(this, uniqueNameErrorMessage, 'Save Failed', false);
            } else {
                ToastUtils.showErrorToast(this, error, 'Save Failed');
            }
        }
    }

    // closes the edit modal and clears any transient validation state
    handleEditCancel() {
        this.isEditModalOpen = false;
        this.editIsValidated = false;
        this.editValidationError = '';
        this.setEditNameValidity('');
        this.setEditSoqlValidity('');
        this.setEditSObjectValidity('');
    }

    // opens the edit modal using the record currently loaded in the detail modal
    handleEdit() {
        this.isModalOpen = false;
        this.editRecord = {
            Id: this.selectedRecord.Id,
            Name: this.selectedRecord.Name,
            DescriptionField__c: this.selectedRecord.DescriptionField__c,
            SObjectAPIName__c: this.selectedRecord.SObjectAPIName__c,
            SOQLField__c: this.selectedRecord.SOQLField__c
        };
        this.editIsValidated = false;
        this.editValidationError = '';
        this.isEditModalOpen = true;
    }

    async handleDeleteClick() {
        const recordToDelete = this.isEditModalOpen && this.editRecord?.Id ? this.editRecord : this.selectedRecord;
        if (!recordToDelete?.Id) {
            return;
        }

        const modalResult = await ConfirmationModal.open({
            size: 'small',
            title: 'Confirm Delete',
            buttonVariant: 'destructive',
            buttonIcon: 'utility:delete',
            buttonLabel: 'Yes, Delete',
            message: `Are you sure you want to delete "${recordToDelete.Name}"? This cannot be undone.`
        });

        if (modalResult !== 'confirm') {
            return;
        }

        try {
            await deleteQuery({ recordId: recordToDelete.Id });
            ToastUtils.showSuccessToast(this, `"${recordToDelete.Name}" has been deleted.`, 'Deleted');
            this.handleEditCancel();
            this.closeModal();
            this.dispatchEvent(new CustomEvent('querychange'));
        } catch (error) {
            ToastUtils.showErrorToast(this, error, 'Delete Failed');
        }
    }

    // validates the currently viewed SOQL without persisting any changes
    handleValidate() {
        const soql = this.selectedRecord.SOQLField__c;
        if (!soql) {
            ToastUtils.showWarningToast(this, 'SOQL body is empty or still loading.', 'Nothing to Validate');
            return;
        }
        this.isValidating = true;
        this.validationResult = null;
        this.showValidation = false;
        validateSoql({ queryString: soql })
            .then(result => {
                this.validationResult = result;
                this.showValidation = true;
            })
            .catch(error => {
                this.validationResult = {
                    isValid: false,
                    errorMessage: this._extractError(error),
                    query: null
                };
                this.showValidation = true;
            })
            .finally(() => {
                this.isValidating = false;
            });
    }

    // clears search and filter inputs, then rebuilds the current table view
    clearFilters() {
        this.searchTerm = '';
        this.selectedSObject = '';
        const searchInput = this.template.querySelector('lightning-input[type="search"]');
        if (searchInput) searchInput.value = '';
        this.applyFiltersAndSort();
    }

    // runs previewQuery and infers datatable columns from the returned rows
    handlePreview() {
        const soql = this.selectedRecord.SOQLField__c;
        if (!soql) {
            ToastUtils.showWarningToast(this, 'SOQL body is empty or still loading.', 'Nothing to Preview');
            return;
        }
        this.isPreviewLoading = true;
        this.previewError = '';
        this.previewRows = [];
        this.previewColumns = [];
        this.isPreviewOpen = true;

        previewQuery({ queryString: soql })
            .then(results => {
                if (results && results.length > 0) {
                    // add a row index to each record so the datatable has a unique key
                    this.previewRows = this.transformPreviewRows(results);
                    this.previewColumns = this.buildPreviewColumns(this.previewRows);
                } else {
                    this.previewError = 'Query returned no records.';
                }
            })
            .catch(error => {
                this.previewError = error.body?.message || 'Preview failed.';
            })
            .finally(() => {
                this.isPreviewLoading = false;
            });
    }

    // closes the preview modal and clears the results
    closePreview() {
        this.isPreviewOpen = false;
        this.previewRows = [];
        this.previewColumns = [];
        this.previewError = '';
    }

    // total number of records matching the current search and filter
    get totalCount() {
        return this.totalRecordCount;
    }

    // count shown in the summary line; grouped view reflects the full filtered result set
    get displayedCount() {
        return this.isGroupedView ? this.filteredRows.length : this.displayedRows.length;
    }

    // total number of pages based on record count and page size
    get totalPages() {
        return Math.max(1, Math.ceil(this.totalRecordCount / this.pageSize));
    }

    // controls whether the empty state or a datatable should render
    get hasRows() {
        return this.isGroupedView ? this.filteredRows.length > 0 : this.displayedRows.length > 0;
    }

    get hasActiveFilters() {
        return !!(this.searchTerm.trim() || this.selectedSObject);
    }

    get isFirstPage() {
        return this.currentPage <= 1;
    }

    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }

    get showPagination() {
        return !this.isGroupedView && this.totalPages > 1;
    }

    get isPageSizeDisabled() {
        return this.isGroupedView;
    }

    get emptyStateTitle() {
        return this.hasActiveFilters ? 'No queries found.' : 'No saved queries found.';
    }

    get emptyStateSubtitle() {
        return this.hasActiveFilters ? 'Adjust your search or filter criteria and try again.' : 'Create a query to start building your library.';
    }

    // formats the last modified date for display in the view modal
    get formattedLastModified() {
        if (!this.selectedRecord.LastModifiedDate) return '';
        return new Date(this.selectedRecord.LastModifiedDate).toLocaleString();
    }

    // returns the right icon for the validation result
    get validationIcon() {
        if (!this.validationResult) return '';
        return this.validationResult.isValid ? 'utility:success' : 'utility:error';
    }

    get validationMessage() {
        if (!this.validationResult) return '';
        return this.validationResult.errorMessage;
    }

    get isValidateDisabled() {
        return this.isLoadingSoql || this.isValidating;
    }

    get isDeleteDisabled() {
        return this.isLoadingSoql;
    }

    get isEditSaveDisabled() {
        return !this.editIsValidated || this.editIsValidating;
    }

    get hasPreviewRows() {
        return this.previewRows.length > 0;
    }

    get editSoqlFieldContainerClass() {
        return `date-format-fix${this.editIsValidated ? ' soql-field-container_valid' : ''}`;
    }

    // gets grouped record by sobject
    get groupedRecords() {
        const groups = {};
        this.filteredRows.forEach(row => {
            const key = row.SObjectAPIName__c || 'Unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        return Object.keys(groups)
            .sort()
            .map(key => ({
                sObject: key,
                records: groups[key],
                countLabel: `${groups[key].length} ${groups[key].length === 1 ? 'query' : 'queries'}`
            }));
    }

    // uses the modern async clipboard API to copy SOQL text from the library UI
    async copyTextToClipboard(text) {
        if (!navigator?.clipboard?.writeText) {
            throw new Error('Clipboard API is not available.');
        }

        await navigator.clipboard.writeText(text);
    }

    _extractError(error) {
        return ToastUtils.extractErrorMessage(error);
    }

    buildPreviewColumns(rows) {
        const keys = Object.keys(rows[0] || {}).filter(key => key !== 'attributes' && key !== '_rowIndex' && !key.endsWith('__url'));
        return keys.map(fieldName => this.buildPreviewColumn(fieldName, rows));
    }

    buildPreviewColumn(fieldName, rows) {
        const sampleValue = rows.map(row => row[fieldName]).find(value => value !== null && value !== undefined && value !== '');
        const inferredType = this.inferPreviewColumnType(fieldName, sampleValue);

        const column = {
            label: fieldName,
            fieldName: inferredType === 'record-url' ? `${fieldName}__url` : fieldName,
            type: inferredType,
            wrapText: inferredType === 'text' || inferredType === 'url'
        };

        if (inferredType === 'record-url') {
            column.type = 'url';
            column.typeAttributes = {
                label: { fieldName },
                target: '_blank'
            };
        }

        if (inferredType === 'url') {
            column.typeAttributes = {
                label: { fieldName },
                target: '_blank'
            };
        }

        if (inferredType === 'date') {
            column.typeAttributes = {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            };
        }

        if (inferredType === 'datetime') {
            column.type = 'date';
            column.typeAttributes = {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
        }

        if (inferredType === 'number') {
            column.cellAttributes = { alignment: 'left' };
        }

        return column;
    }

    inferPreviewColumnType(fieldName, value) {
        if (this.isSalesforceIdValue(value)) {
            return 'record-url';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        if (typeof value !== 'string') {
            return 'text';
        }

        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return 'text';
        }

        if (this.isIsoDateTimeValue(trimmedValue) || fieldName.endsWith('DateTime')) {
            return 'datetime';
        }

        if (this.isIsoDateValue(trimmedValue) || fieldName.endsWith('Date')) {
            return 'date';
        }

        if (this.isUrlValue(trimmedValue)) {
            return 'url';
        }

        if (this.isEmailValue(trimmedValue)) {
            return 'email';
        }

        if (this.isPhoneValue(trimmedValue)) {
            return 'phone';
        }

        if (this.isNumericValue(trimmedValue)) {
            return 'number';
        }

        return 'text';
    }

    transformPreviewRows(rows) {
        return rows.map((row, index) => {
            const transformedRow = {
                ...row,
                _rowIndex: index
            };

            Object.keys(row).forEach(fieldName => {
                const value = row[fieldName];
                if (this.isSalesforceIdValue(value)) {
                    transformedRow[`${fieldName}__url`] = `/${value}`;
                }
            });

            return transformedRow;
        });
    }

    isIsoDateValue(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    isIsoDateTimeValue(value) {
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(value);
    }

    isUrlValue(value) {
        return /^https?:\/\//i.test(value);
    }

    isEmailValue(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    isPhoneValue(value) {
        return /^\+?[\d\s().-]{7,}$/.test(value);
    }

    isNumericValue(value) {
        return /^-?\d+(?:\.\d+)?$/.test(value);
    }

    isSalesforceIdValue(value) {
        return typeof value === 'string' && /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(value);
    }

    setEditSoqlValidity(message) {
        const soqlInput = this.template.querySelector('lightning-textarea[data-field="SOQLField__c"]');

        if (!soqlInput) {
            return;
        }

        soqlInput.setCustomValidity(message || '');
        soqlInput.reportValidity();
    }

    setEditNameValidity(message) {
        const nameInput = this.template.querySelector('lightning-input[data-field="Name"]');

        if (!nameInput) {
            return;
        }

        nameInput.setCustomValidity(message || '');
        nameInput.reportValidity();
    }

    setEditSObjectValidity(message) {
        const sObjectInput = this.template.querySelector('c-searchable-combobox[data-field="SObjectAPIName__c"]');

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
    handleToggleView() {
        this.isGroupedView = !this.isGroupedView;
    }
    get toggleViewLabel() {
        return this.isGroupedView ? 'Switch to Table View' : 'Switch to Grouped View';
    }

    get toggleViewIcon() {
        return this.isGroupedView ? 'utility:table' : 'utility:rows';
    }

    handlePageSizeChange(event) {
        this.pageSize = parseInt(event.detail.value);
        this.currentPage = 1;
        this.loadQueries();
    }
    get pageSizeOptions() {
        return [
            { label: '5', value: '5' },
            { label: '10', value: '10' },
            { label: '25', value: '25' },
            { label: '50', value: '50' }
        ];
    }

    getSortableValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (value instanceof Date) {
            return value.getTime();
        }

        const parsedDate = Date.parse(value);
        if (!Number.isNaN(parsedDate) && this.sortedBy === 'LastModifiedDate') {
            return parsedDate;
        }

        return String(value).toLowerCase();
    }
}