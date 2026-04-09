import { api, LightningElement } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import fuseResource from '@salesforce/resourceUrl/Fuse';
import dateFormatStyleFix from '@salesforce/resourceUrl/DateFormatStyleFix';

/**
 * @description       : Reusable searchable combobox component for selecting from picklist-style option sets.
 * Supports Fuse-based searching, optional descriptions, disabled state handling,
 * and selection events used by Query Vault, the Quick Search Wizard, and other admin flows.
 * @author            : Larry Reaux, Ergon
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 *
 *  @usage
 * -> Rendered anywhere a searchable dropdown is needed for option lists with label/value/description data.
 */
export default class SearchableCombobox extends LightningElement {
    _picklistOptions = [];
    _value = '';

    @api label;
    @api placeholder;
    @api required = false;
    @api disabled = false;
    @api showDescription = false;

    fuse;
    fuseLoaded = false;
    hasFuseLoadStarted = false;
    stylesLoaded = false;

    isListening = false;
    hasFocusWithin = false;
    searchResults = [];
    selectedSearchResult = null;
    inputText = '';

    @api
    get picklistOptions() {
        return this._picklistOptions;
    }
    set picklistOptions(value) {
        this._picklistOptions = Array.isArray(value) ? [...value] : [];
        this.syncSelectedResult();
        this.syncInputTextToSelection();
        this.clearSearchResults();
        this.initializeFuse();
    }

    @api
    get value() {
        return this._value;
    }
    set value(newValue) {
        this._value = newValue || '';
        this.syncSelectedResult();
        this.inputText = this.selectedSearchResult?.label || '';
    }

    get inputValue() {
        return this.inputText;
    }

    get hasSearchResults() {
        return this.searchResults.length > 0;
    }

    renderedCallback() {
        if (!this.stylesLoaded) {
            this.stylesLoaded = true;

            loadStyle(this, dateFormatStyleFix).catch(error => {
                // eslint-disable-next-line no-console
                console.error('Error loading DateFormatStyleFix:', error);
            });
        }

        if (!this.isListening) {
            window.addEventListener('click', this.handleWindowClick);
            this.isListening = true;
        }

        if (!this.fuseLoaded && !this.hasFuseLoadStarted) {
            this.hasFuseLoadStarted = true;
            loadScript(this, fuseResource)
                .then(() => {
                    this.fuseLoaded = true;
                    this.initializeFuse();
                })
                .catch(error => {
                    this.hasFuseLoadStarted = false;
                    // eslint-disable-next-line no-console
                    console.error('Error loading Fuse.js', error);
                });
        }
    }

    disconnectedCallback() {
        if (this.isListening) {
            window.removeEventListener('click', this.handleWindowClick);
            this.isListening = false;
        }
    }

    handleWindowClick = event => {
        if (this.hasFocusWithin) {
            return;
        }

        if (this._value) {
            this.syncInputTextToSelection();
        }

        this.clearSearchResults();
    };

    handleFocusIn() {
        this.hasFocusWithin = true;
    }

    handleFocusOut() {
        window.clearTimeout(this.focusOutTimeout);
        this.focusOutTimeout = window.setTimeout(() => {
            const activeElement = this.template.activeElement;
            this.hasFocusWithin = !!activeElement;

            if (!this.hasFocusWithin) {
                if (this._value) {
                    this.syncInputTextToSelection();
                }

                this.clearSearchResults();
            }
        }, 0);
    }

    initializeFuse() {
        if (!this.fuseLoaded || typeof Fuse === 'undefined') {
            return;
        }

        this.fuse = new Fuse(this._picklistOptions, {
            keys: ['label', 'value', 'description'],
            includeScore: true,
            threshold: 0.3,
            ignoreLocation: true
        });
    }

    syncSelectedResult() {
        this.selectedSearchResult = this._picklistOptions.find(option => option.value === this._value) || null;
    }

    syncInputTextToSelection() {
        this.inputText = this.selectedSearchResult?.label || '';
    }

    search(event) {
        if (this.disabled) {
            return;
        }

        this.inputText = event.detail.value || '';
        const input = this.inputText.toLowerCase();

        if (!input) {
            this._value = '';
            this.selectedSearchResult = null;
            this.searchResults = [...this.picklistOptions];

            this.dispatchEvent(
                new CustomEvent('optionselect', {
                    detail: {
                        value: '',
                        option: null
                    }
                })
            );
            return;
        }

        if (this.fuse) {
            this.searchResults = this.fuse.search(this.inputText).map(result => result.item);
            return;
        }

        // fallback if fuse is unavailable
        this.searchResults = this.picklistOptions.filter(option => {
            const label = option.label?.toLowerCase() || '';
            const value = option.value?.toLowerCase() || '';
            const description = option.description?.toLowerCase() || '';

            return label.includes(input) || value.includes(input) || description.includes(input);
        });
    }

    selectSearchResult(event) {
        if (this.disabled) {
            return;
        }

        event.preventDefault();
        const selectedValue = event.currentTarget.dataset.value;
        this._value = selectedValue;
        this.syncSelectedResult();
        this.syncInputTextToSelection();
        this.clearSearchResults();

        this.dispatchEvent(
            new CustomEvent('optionselect', {
                detail: {
                    value: this._value,
                    option: this.selectedSearchResult
                }
            })
        );
    }

    clearSearchResults() {
        this.searchResults = [];
    }

    showPickListOptions() {
        if (this.disabled) {
            return;
        }

        this.searchResults = [...this.picklistOptions];
    }

    @api
    checkValidity() {
        return this.inputElement?.checkValidity() ?? true;
    }

    @api
    reportValidity() {
        return this.inputElement?.reportValidity() ?? true;
    }

    @api
    setCustomValidity(message) {
        this.inputElement?.setCustomValidity(message || '');
    }

    @api
    focus() {
        this.inputElement?.focus();
    }

    get inputElement() {
        return this.template.querySelector('lightning-input');
    }
}