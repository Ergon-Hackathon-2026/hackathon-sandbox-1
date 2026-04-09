import { api, LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import SheetJS from '@salesforce/resourceUrl/SheetJS';
import { ToastUtils } from 'c/toastUtils';
import bulkSaveQueries from '@salesforce/apex/SoqlValidator.bulkSaveQueries';

const MAX_UPLOAD_ROWS = 50;
const TEMPLATE_HEADERS = ['Name', 'Description', 'SObject API Name', 'SOQL'];

const PREVIEW_COLUMNS = [
    { label: 'Name', fieldName: 'name', type: 'text', wrapText: true },
    { label: 'Description', fieldName: 'description', type: 'text', wrapText: true },
    { label: 'SObject API Name', fieldName: 'sObjectApiName', type: 'text' },
    { label: 'SOQL', fieldName: 'soql', type: 'text', wrapText: true },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [{ label: 'Remove Row', name: 'remove_row', iconName: 'utility:delete' }]
        }
    }
];

/**
 * @description       : Bulk query creation workflow for Query Vault.
 * Supports downloading the template, choosing between pasted rows or uploaded workbooks,
 * performing lightweight client-side validation, and submitting valid rows to Apex
 * for SOQL validation and partial-save processing.
 * @author            : Larry Reaux, Ergon
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 *
 *  @usage
 * -> Rendered inside UsefulQueries as the bulk-upload tab for creating multiple UsefulQuery__c records.
 */
export default class BulkQueryEditor extends LightningElement {
    static INPUT_MODE_OPTIONS = [
        { label: 'Paste Rows', value: 'paste' },
        { label: 'Upload File', value: 'file' }
    ];

    _sObjectOptions = [];
    sheetjsInitialized = false;
    sheetjsLoadStarted = false;
    isSubmitting = false;
    inputMode = 'paste';

    @track pastedRowsText = '';
    @track previewRows = [];
    @track submissionErrorMessages = [];
    @track selectedRowIds = [];
    @track uploadedFileName = '';

    @api
    get sObjectOptions() {
        return this._sObjectOptions;
    }
    set sObjectOptions(value) {
        this._sObjectOptions = Array.isArray(value) ? value : [];
    }

    columns = PREVIEW_COLUMNS;

    get inputModeOptions() {
        return BulkQueryEditor.INPUT_MODE_OPTIONS;
    }

    get isPasteMode() {
        return this.inputMode === 'paste';
    }

    get isFileMode() {
        return this.inputMode === 'file';
    }

    renderedCallback() {
        if (this.sheetjsInitialized || this.sheetjsLoadStarted) {
            return;
        }

        this.sheetjsLoadStarted = true;
        loadScript(this, SheetJS)
            .then(() => {
                this.sheetjsInitialized = true;
            })
            .catch(error => {
                this.sheetjsLoadStarted = false;
                ToastUtils.showErrorToast(this, error, 'Template Download Unavailable');
            });
    }

    get previewCountLabel() {
        return `${this.previewRows.length} parsed row${this.previewRows.length === 1 ? '' : 's'} ready for review`;
    }

    get hasPreviewRows() {
        return this.previewRows.length > 0;
    }

    get hasUploadedFile() {
        return !!this.uploadedFileName;
    }

    get invalidSObjectCount() {
        return this.previewRows.filter(row => !row.isSObjectValid).length;
    }

    get invalidRowCount() {
        return this.previewRows.filter(row => !row.isRowValid).length;
    }

    get warningRowCount() {
        return this.previewRows.filter(row => (row.warningMessages || []).length > 0).length;
    }

    get previewTableErrors() {
        const rowErrors = {};

        this.previewRows.forEach(row => {
            if (row.isRowValid) {
                return;
            }

            rowErrors[row.id] = {
                title: 'Row Needs Attention',
                messages: row.validationMessages,
                fieldNames: row.errorFieldNames
            };
        });

        const errors = { rows: rowErrors };

        if (this.invalidRowCount > 0) {
            errors.table = {
                title: 'Some rows need attention before upload.',
                messages: [
                    'One or more rows are missing required values or contain an SObject API Name that is not available in the org.',
                    ...this.submissionErrorMessages
                ]
            };
        } else if (this.submissionErrorMessages.length > 0) {
            errors.table = {
                title: 'Bulk upload rejected one or more rows.',
                messages: this.submissionErrorMessages
            };
        }

        return errors;
    }

    get templateHint() {
        return `Template supports up to ${MAX_UPLOAD_ROWS} rows per upload.`;
    }

    get isSubmitDisabled() {
        return this.isSubmitting || !this.hasPreviewRows || this.invalidRowCount > 0;
    }

    get isRemoveSelectedDisabled() {
        return this.isSubmitting || this.selectedRowIds.length === 0;
    }

    handleDownloadTemplate() {
        if (!this.sheetjsInitialized || !window.XLSX) {
            ToastUtils.showWarningToast(this, 'Template download is still loading. Please try again in a moment.', 'Loading Template');
            return;
        }

        const templateSheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
        templateSheet['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 24 }, { wch: 90 }];

        const instructionsSheet = XLSX.utils.aoa_to_sheet([
            ['Bulk Useful Query Upload'],
            ['Paste rows from the first sheet back into the Bulk Upload tab.'],
            ['Required column order: Name, Description, SObject API Name, SOQL.'],
            ['Name values must be unique.'],
            [this.templateHint]
        ]);
        instructionsSheet['!cols'] = [{ wch: 100 }];

        const sObjectOptionsSheet = XLSX.utils.aoa_to_sheet([['Allowed SObject API Names'], ...this.sObjectOptions.map(option => [option.value])]);
        sObjectOptionsSheet['!cols'] = [{ wch: 40 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Useful Queries Template');
        XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
        XLSX.utils.book_append_sheet(workbook, sObjectOptionsSheet, 'SObject Options');
        XLSX.writeFile(workbook, 'UsefulQueryBulkTemplate.xlsx');
    }

    handlePasteInputChange(event) {
        this.pastedRowsText = event.target.value || '';
    }

    handleInputModeChange(event) {
        this.inputMode = event.detail.value || 'paste';
    }

    handleParsePastedRows() {
        const parsedRows = this.parsePastedRows(this.pastedRowsText);
        if (!parsedRows.length) {
            ToastUtils.showWarningToast(this, 'Paste rows copied from the Excel template before parsing.', 'No Rows Detected');
            return;
        }

        this.processParsedRows(parsedRows, 'paste');
    }

    async handleFileUploadChange(event) {
        const file = event.target.files?.[0];
        if (!file) {
            this.uploadedFileName = '';
            return;
        }

        if (!this.sheetjsInitialized || !window.XLSX) {
            ToastUtils.showWarningToast(this, 'File parsing is still loading. Please try again in a moment.', 'Loading Upload Parser');
            this.resetFileInput();
            return;
        }

        this.uploadedFileName = file.name;

        try {
            const parsedRows = await this.parseUploadedWorkbook(file);
            if (!parsedRows.length) {
                ToastUtils.showWarningToast(this, 'The uploaded file did not contain any data rows to parse.', 'No Rows Detected');
                return;
            }

            this.processParsedRows(parsedRows, 'file');
        } catch (error) {
            this.uploadedFileName = '';
            this.resetFileInput();
            ToastUtils.showErrorToast(this, error, 'File Upload Parse Failed');
        }
    }

    handleClearPreview() {
        this.pastedRowsText = '';
        this.previewRows = [];
        this.submissionErrorMessages = [];
        this.selectedRowIds = [];
        this.uploadedFileName = '';
        this.resetFileInput();
    }

    async handleSubmitRows() {
        if (!this.hasPreviewRows) {
            ToastUtils.showWarningToast(this, 'Parse some rows before submitting.', 'No Rows Ready');
            return;
        }

        if (this.invalidRowCount > 0) {
            ToastUtils.showWarningToast(this, 'Resolve or remove the rows needing attention before submitting.', 'Review Rows');
            return;
        }

        this.isSubmitting = true;

        try {
            const result = await bulkSaveQueries({
                rows: this.previewRows.map(row => ({
                    rowNumber: row.id,
                    name: row.name,
                    description: row.description,
                    sObjectApiName: row.sObjectApiName,
                    soql: row.soql
                }))
            });

            const previousRows = [...this.previewRows];
            const failedResults = (result?.rowResults || []).filter(rowResult => !rowResult.success);
            this.submissionErrorMessages = failedResults.map(rowResult => `Row ${rowResult.rowNumber}: ${rowResult.message}`);

            const failedResultsByRowNumber = new Map(failedResults.map(rowResult => [Number(rowResult.rowNumber), rowResult]));

            let failedPreviewRows = previousRows
                .filter(row => failedResultsByRowNumber.has(row.id))
                .map(row => {
                    const failedResult = failedResultsByRowNumber.get(row.id);
                    return {
                        ...row,
                        isRowValid: false,
                        validationMessages: [failedResult.message],
                        errorFieldNames: []
                    };
                });

            if (failedResults.length > 0 && failedPreviewRows.length === 0 && failedResults.length === previousRows.length) {
                failedPreviewRows = previousRows.map((row, index) => ({
                    ...row,
                    isRowValid: false,
                    validationMessages: [failedResults[index].message],
                    errorFieldNames: []
                }));
            }

            this.previewRows = result?.rejectedCount > 0 && failedPreviewRows.length === 0 ? previousRows : failedPreviewRows;
            this.selectedRowIds = [];

            if ((result?.createdCount || 0) > 0 && (result?.rejectedCount || 0) === 0) {
                this.pastedRowsText = '';
                this.uploadedFileName = '';
                this.resetFileInput();
            }

            if (result?.createdCount > 0) {
                this.dispatchEvent(new CustomEvent('querychange'));
            }

            if (result?.createdCount > 0 && result?.rejectedCount > 0) {
                ToastUtils.showSuccessToast(
                    this,
                    `${result.createdCount} quer${result.createdCount === 1 ? 'y' : 'ies'} created. ${result.rejectedCount} row${result.rejectedCount === 1 ? '' : 's'} rejected.`
                );
            } else if (result?.createdCount > 0) {
                ToastUtils.showSuccessToast(
                    this,
                    `${result.createdCount} quer${result.createdCount === 1 ? 'y was' : 'ies were'} created successfully.`
                );
            } else if (result?.rejectedCount > 0) {
                ToastUtils.showWarningToast(this, 'No queries were created. Review the remaining rows for details.', 'Upload Rejected');
            }
        } catch (error) {
            ToastUtils.showErrorToast(this, error, 'Bulk Upload Failed');
        } finally {
            this.isSubmitting = false;
        }
    }

    handleRowAction(event) {
        if (this.isSubmitting) {
            return;
        }

        if (event.detail.action?.name !== 'remove_row') {
            return;
        }

        const rowId = event.detail.row?.id;
        this.previewRows = this.previewRows.filter(row => row.id !== rowId);
        this.selectedRowIds = this.selectedRowIds.filter(selectedRowId => selectedRowId !== rowId);
    }

    handleRowSelection(event) {
        this.selectedRowIds = (event.detail.selectedRows || []).map(row => row.id);
    }

    handleRemoveSelectedRows() {
        if (this.selectedRowIds.length === 0) {
            return;
        }

        const selectedRowIds = new Set(this.selectedRowIds);
        this.previewRows = this.previewRows.filter(row => !selectedRowIds.has(row.id));
        this.selectedRowIds = [];
    }

    processParsedRows(parsedRows, source) {
        const normalizedRows = parsedRows
            .filter(columns => columns.some(value => `${value || ''}`.trim()))
            .slice(0, MAX_UPLOAD_ROWS)
            .map((columns, index) => this.buildPreviewRow(columns, index));

        this.applyDuplicateNameValidation(normalizedRows);

        this.previewRows = normalizedRows;
        this.submissionErrorMessages = [];
        this.selectedRowIds = [];

        if (this.invalidRowCount > 0) {
            ToastUtils.showWarningToast(
                this,
                `${this.invalidRowCount} row${this.invalidRowCount === 1 ? '' : 's'} need attention before upload.`,
                source === 'file' ? 'Review Uploaded Rows' : 'Review Parsed Rows'
            );
        }

        if (this.warningRowCount > 0) {
            ToastUtils.showInfoToast(
                this,
                `${this.warningRowCount} row${this.warningRowCount === 1 ? '' : 's'} included extra columns that will be ignored.`,
                source === 'file' ? 'Upload Warnings' : 'Parse Warnings'
            );
        }

        if (parsedRows.length > MAX_UPLOAD_ROWS) {
            ToastUtils.showWarningToast(
                this,
                `Only the first ${MAX_UPLOAD_ROWS} rows were loaded to stay within the bulk upload limit.`,
                'Row Limit Applied'
            );
        }
    }

    parsePastedRows(rawText) {
        const lines = (rawText || '')
            .split(/\r?\n/)
            .map(line => line.trimEnd())
            .filter(Boolean);

        if (!lines.length) {
            return [];
        }

        const rows = lines.map(line => this.normalizeRawColumns(line.split('\t').map(cell => cell.trim())));
        const firstRow = rows[0] || [];
        const normalizedHeader = firstRow.map(value => value.toLowerCase());
        const templateHeader = TEMPLATE_HEADERS.map(value => value.toLowerCase());
        const hasHeaderRow = templateHeader.every((header, index) => normalizedHeader[index] === header);

        return hasHeaderRow ? rows.slice(1) : rows;
    }

    async parseUploadedWorkbook(file) {
        const fileData = await this.readFileAsArrayBuffer(file);
        const workbook = XLSX.read(fileData, { type: 'array' });
        const preferredSheetName = workbook.SheetNames.includes('Useful Queries Template') ? 'Useful Queries Template' : workbook.SheetNames[0];

        if (!preferredSheetName) {
            return [];
        }

        const worksheet = workbook.Sheets[preferredSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            blankrows: false,
            defval: ''
        });

        if (!Array.isArray(rows) || rows.length === 0) {
            return [];
        }

        const normalizedRows = rows.map(row => this.normalizeRawColumns(row.map(cell => `${cell ?? ''}`.trim())));
        const firstRow = normalizedRows[0] || [];
        const normalizedHeader = firstRow.map(value => value.toLowerCase());
        const templateHeader = TEMPLATE_HEADERS.map(value => value.toLowerCase());
        const hasHeaderRow = templateHeader.every((header, index) => normalizedHeader[index] === header);

        return hasHeaderRow ? normalizedRows.slice(1) : normalizedRows;
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('The selected file could not be read.'));
            reader.readAsArrayBuffer(file);
        });
    }

    buildPreviewRow(columns, index) {
        const sObjectApiName = columns[2] || '';
        const isSObjectValid = this.isAllowedSObjectApiName(sObjectApiName);
        const validationMessages = [];
        const errorFieldNames = [];
        const warningMessages = [];

        if (!columns[0]?.trim()) {
            validationMessages.push('Name is required.');
            errorFieldNames.push('name');
        }

        if (!columns[1]?.trim()) {
            validationMessages.push('Description is required.');
            errorFieldNames.push('description');
        }

        if (!sObjectApiName) {
            validationMessages.push('SObject API Name is required.');
            errorFieldNames.push('sObjectApiName');
        } else if (!isSObjectValid) {
            validationMessages.push('SObject API Name must be an SObject available in the org.');
            errorFieldNames.push('sObjectApiName');
        }

        if (!columns[3]?.trim()) {
            validationMessages.push('SOQL is required.');
            errorFieldNames.push('soql');
        }

        if (columns.length > TEMPLATE_HEADERS.length) {
            warningMessages.push('Extra columns were detected and ignored.');
        }

        return {
            id: index + 1,
            name: columns[0] || '',
            description: columns[1] || '',
            sObjectApiName,
            soql: columns[3] || '',
            isSObjectValid,
            isRowValid: validationMessages.length === 0,
            validationMessages,
            warningMessages,
            errorFieldNames
        };
    }

    applyDuplicateNameValidation(rows) {
        const nameCounts = new Map();

        rows.forEach(row => {
            const normalizedName = this.normalizeName(row.name);
            if (!normalizedName) {
                return;
            }

            nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
        });

        rows.forEach(row => {
            const normalizedName = this.normalizeName(row.name);
            if (!normalizedName || (nameCounts.get(normalizedName) || 0) < 2) {
                return;
            }

            if (!row.validationMessages.includes('A query with this name appears more than once in the upload.')) {
                row.validationMessages.push('A query with this name appears more than once in the upload.');
            }

            if (!row.errorFieldNames.includes('name')) {
                row.errorFieldNames.push('name');
            }

            row.isRowValid = false;
        });
    }

    isAllowedSObjectApiName(sObjectApiName) {
        if (!sObjectApiName) {
            return false;
        }

        return this.sObjectOptions.some(option => option.value?.toLowerCase() === sObjectApiName.toLowerCase());
    }

    normalizeName(name) {
        return name?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
    }

    normalizeRawColumns(columns) {
        const normalizedColumns = Array.isArray(columns) ? [...columns] : [];

        while (normalizedColumns.length > 0 && !`${normalizedColumns[normalizedColumns.length - 1] ?? ''}`.trim()) {
            normalizedColumns.pop();
        }

        return normalizedColumns;
    }

    resetFileInput() {
        const fileInput = this.template.querySelector('[data-id="template-upload"]');
        if (fileInput) {
            fileInput.value = null;
        }
    }
}