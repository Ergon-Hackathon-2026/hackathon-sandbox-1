import { api, LightningElement } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import PrismJs from '@salesforce/resourceUrl/PrismJs';
import PrismCss from '@salesforce/resourceUrl/PrismCss';

// Shared module-level Prism load promise so multiple component instances don't
// each trigger their own static resource load.
let prismInitialized;

/**
 * @description       : Reusable syntax-highlighted code block with optional clipboard copy support.
 * Loads Prism resources once, renders highlighted code for the requested language,
 * and is used anywhere the admin experience needs readable copyable code or SOQL output.
 * @author            : Larry Reaux, Ergon
 * @group             : Ergon
 * @created on        : 03-21-2026
 * @last modified by  : Larry Reaux
 * @last modified on  : 04-02-2026
 *
 *  @usage
 * -> Rendered by Query Vault and other admin components when formatted code needs to be displayed and copied.
 */
export default class CopyableCodeblock extends LightningElement {
    @api code = '';
    @api language = 'javascript';
    @api label = 'Code Snippet';
    @api hideCopyButton = false;

    prismLoaded = false;
    tokenSegments = [];
    lastTokenizedKey = null;
    segmentKeyCounter = 0;

    get showCopyButton() {
        return !this.hideCopyButton;
    }

    get normalizedLanguage() {
        return this.language === 'html' ? 'markup' : this.language;
    }

    get codeClass() {
        return `language-${this.normalizedLanguage}`;
    }

    async renderedCallback() {
        try {
            await this.initializePrism();
            this.tokenizeCode();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error initializing Prism:', error);
        }
    }

    async initializePrism() {
        if (this.prismLoaded) {
            return;
        }

        if (!prismInitialized) {
            prismInitialized = Promise.all([loadScript(this, PrismJs), loadStyle(this, PrismCss)]);
        }

        await prismInitialized;
        this.prismLoaded = true;
    }

    tokenizeCode() {
        const tokenizationKey = `${this.normalizedLanguage}::${this.code || ''}`;
        if (this.lastTokenizedKey === tokenizationKey) {
            return;
        }

        if (!this.prismLoaded || !window.Prism) {
            this.segmentKeyCounter = 0;
            this.tokenSegments = [this.buildSegment(this.code || '', '')];
            this.lastTokenizedKey = tokenizationKey;
            return;
        }

        const grammar = window.Prism.languages[this.normalizedLanguage];
        if (!grammar) {
            this.segmentKeyCounter = 0;
            this.tokenSegments = [this.buildSegment(this.code || '', '')];
            this.lastTokenizedKey = tokenizationKey;
            return;
        }

        this.segmentKeyCounter = 0;
        const tokens = window.Prism.tokenize(this.code || '', grammar);
        this.tokenSegments = this.flattenTokens(tokens);
        this.lastTokenizedKey = tokenizationKey;
    }

    flattenTokens(tokens, inheritedClasses = []) {
        const segments = [];
        const normalizedTokens = Array.isArray(tokens) ? tokens : [tokens];

        normalizedTokens.forEach(token => {
            if (token === null || token === undefined) {
                return;
            }

            if (typeof token === 'string') {
                segments.push(this.buildSegment(token, inheritedClasses.join(' ')));
                return;
            }

            const tokenClasses = [...inheritedClasses, 'token', token.type];
            if (token.alias) {
                if (Array.isArray(token.alias)) {
                    tokenClasses.push(...token.alias);
                } else {
                    tokenClasses.push(token.alias);
                }
            }

            segments.push(...this.flattenTokens(token.content, tokenClasses));
        });

        return segments;
    }

    buildSegment(content, className) {
        return {
            key: `segment-${this.segmentKeyCounter++}`,
            content,
            className
        };
    }

    async handleCopy() {
        try {
            await navigator.clipboard.writeText(this.code || '');
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Copied',
                    message: 'Code copied to clipboard.',
                    variant: 'success'
                })
            );
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Copy Failed',
                    message: 'Could not copy code to clipboard.',
                    variant: 'error'
                })
            );
        }
    }
}