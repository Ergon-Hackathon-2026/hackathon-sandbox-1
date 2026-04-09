import { ShowToastEvent } from 'lightning/platformShowToastEvent';
/**
 * @author  Anthony Berrios, Ergon Inc, on 12/15/2025
 * @class   ToastUtils
 * @description
 * Static utility class for displaying toast notifications in Lightning Web Components (LWC),
 * as well as extracting user-friendly error messages from Apex errors.
 *
 *  @usage
 * -> Show a success toast
 * ToastUtils.showSuccessToast(this, 'Operation completed successfully');
 * ToastUtils.showSuccessToast(this, 'Saved!', 'Success Title');
 * ToastUtils.showSuccessToast(this, 'Saved!', 'Success Title', true);
 *
 * -> Show an error toast from an Apex error
 * ToastUtils.showErrorToast(this, error); -> Uses default title and sticky mode
 * ToastUtils.showErrorToast(this, error, 'Save Failed');
 * ToastUtils.showErrorToast(this, error, 'Save Failed', false);
 *
 * -> Show a warning toast
 * ToastUtils.showWarningToast(this, 'Please double-check your input');
 * ToastUtils.showWarningToast(this, 'Warning!', 'Custom Warning Title');
 * ToastUtils.showWarningToast(this, 'Warning!', 'Custom Warning Title', true);
 *
 * -> Show an informational toast
 * ToastUtils.showInfoToast(this, 'This is just for your information');
 * ToastUtils.showInfoToast(this, 'Heads Up!', 'Info Title');
 * ToastUtils.showInfoToast(this, 'Heads Up!', 'Info Title', true);
 *
 * -> Show a custom toast directly
 * ToastUtils.showToast(this, 'Custom Title', 'Custom message content', 'success');
 * ToastUtils.showToast(this, 'Alert', 'An error occurred', 'error', true);
 * ToastUtils.showToast(this, 'Reminder', 'This is a reminder', 'info');
 *
 * -> Show multiple error toasts with custom titles
 * const errorList = [
 *     { title: 'Validation Error', message: 'Name is required' },
 *     { title: 'Server Error', message: 'Internal server error' },
 *     { message: 'Unknown error occurred' } -> Uses default title 'Error'
 * ];
 * ToastUtils.showMultipleErrorToastsWithTitles(this, errorList);
 *
 * -> Extract a user-friendly error message
 * const friendlyMessage = ToastUtils.extractErrorMessage(error);
 *
 */

export class ToastUtils {
    /**
     * @method extractErrorMessage
     * @description
     * Extracts a user-friendly error message from the error object returned by Apex.
     * @param {Object} error - The error object from the Apex call
     * @returns {string} A formatted error message for display to the user
     */
    static extractErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }
        if (error?.body?.message) {
            const message = error.body.message;
            if (!message.includes('Variable does not exist') && !message.includes('tmpVar')) {
                return message;
            }
        }

        if (error?.message) {
            return error.message;
        }
        if (error?.body?.fieldErrors && Object.keys(error.body.fieldErrors).length > 0) {
            const fieldErrors = Object.values(error.body.fieldErrors).flat();
            return fieldErrors.map(fieldError => fieldError.message).join('; ');
        }
        if (error?.body?.pageErrors && error.body.pageErrors.length > 0) {
            return error.body.pageErrors.map(pageError => pageError.message).join('; ');
        }
        return 'An unexpected error occurred. Please contact your system administrator(s).';
    }

    /**
     * @method showToast
     * @description
     * Displays a toast message using the Lightning Platform ShowToastEvent.
     * @param {Object} component - The LWC component instance (this)
     * @param {string} title - The title of the toast
     * @param {string} message - The body content of the toast
     * @param {string} variant - The style of the toast
     * @param {boolean} isPersistent - Whether the toast should require manual dismissal
     */
    static showToast(component, title, message, variant, isPersistent = false) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: isPersistent ? 'sticky' : 'dismissible'
        });
        component.dispatchEvent(toastEvent);
    }

    /**
     * @method showErrorToast
     * @description
     * Convenience method to display an error toast with extracted error message.
     * @param {Object} component - The LWC component instance
     * @param {Object} error - The error object (not a string)
     * @param {string} title - The title for the error toast
     * @param {boolean} isPersistent - Whether the toast should require manual dismissal
     */
    static showErrorToast(component, error, title = 'Error', isPersistent = true) {
        const errorMessage = this.extractErrorMessage(error);
        this.showToast(component, title, errorMessage, 'error', isPersistent);
    }

    /**
     * @method showMultipleErrorToastsWithTitles
     * @description
     * Shows multiple error messages with custom titles as separate toasts with staggered timing.
     * @param {Object} component - The LWC component instance
     * @param {Array<Object>} errorObjects - Array of objects with {title: string, message: string}
     */
    static showMultipleErrorToastsWithTitles(component, errorObjects) {
        if (!errorObjects || errorObjects.length === 0) return;

        errorObjects.forEach((errorObj, index) => {
            // Stagger toasts slightly so they don't all appear at once
            setTimeout(() => {
                // Use showToast directly with custom title
                this.showToast(component, errorObj.title || 'Error', errorObj.message, 'error', true);
            }, index * 300);
        });
    }

    /**
     * @method showSuccessToast
     * @description
     * Convenience method to display a success toast with custom extracted success message.
     * @param {Object} component - The LWC component instance
     * @param {string} message - The message string
     * @param {string} title - The title for the success toast
     * @param {boolean} isPersistent - Whether the toast should require manual dismissal
     */
    static showSuccessToast(component, message, title = 'Success', isPersistent = false) {
        this.showToast(component, title, message, 'success', isPersistent);
    }

    /**
     * @method showWarningToast
     * @description
     * Convenience method to display a warning toast with custom extracted warning message.
     * @param {Object} component - The LWC component instance
     * @param {string} message - The message string
     * @param {string} title - The title for the warning toast
     * @param {boolean} isPersistent - Whether the toast should require manual dismissal
     */
    static showWarningToast(component, message, title = 'Warning', isPersistent = false) {
        this.showToast(component, title, message, 'warning', isPersistent);
    }

    /**
     * @method showInfoToast
     * @description
     * Convenience method to display a info toast with custom extracted info message.
     * @param {Object} component - The LWC component instance
     * @param {string} message - The message string
     * @param {string} title - The title for the info toast
     * @param {boolean} isPersistent - Whether the toast should require manual dismissal
     */
    static showInfoToast(component, message, title = 'Info', isPersistent = false) {
        this.showToast(component, title, message, 'info', isPersistent);
    }

    /**
     * @method showParsedErrorToasts
     * @description
     * Parses an Apex/LDS error into one or more toast notifications.
     * Behavior:
     *  - Uses extractErrorMessage(error) to get a user-friendly string
     *  - Replaces escaped "\n" with actual newlines
     *  - Splits on double newlines to create individual error blocks
     *  - Supports optional "Title|||Message" delimiter per block
     *  - Falls back to a single error toast when nothing parsable is found
     * @param {Object} component - The LWC component instance (this)
     * @param {Object|string} error - Error object or string
     * @param {string} defaultTitle - Title prefix when a block has no explicit title
     */
    static showParsedErrorToasts(component, error, defaultTitle = 'Error') {
        try {
            let message = this.extractErrorMessage(error);

            if (typeof message !== 'string') {
                message = String(message);
            }

            // Convert escaped newlines to real newlines
            message = message.replace(/\\n/g, '\n');

            // Split into logical blocks by double newline
            const blocks = message
                .split('\n\n')
                .map(b => b.trim())
                .filter(b => b.length > 0);

            const errorObjects = blocks.map(b => {
                if (b.includes('|||')) {
                    const parts = b.split('|||');
                    const title = (parts[0] || defaultTitle).trim();
                    const body = (parts.slice(1).join('|||') || '').trim();
                    return { title, message: body };
                }
                return { title: `${defaultTitle}:`, message: b };
            });

            if (errorObjects.length > 0) {
                this.showMultipleErrorToastsWithTitles(component, errorObjects);
            } else {
                this.showErrorToast(component, error, `${defaultTitle}:`);
            }
        } catch (parseErr) {
            // Fallback to a single error toast if parsing fails unexpectedly
            this.showErrorToast(component, error, `${defaultTitle}:`);
        }
    }

    /**
     * @method parseTableErrors
     * @description
     * Parses a custom-formatted Apex error string into a structured object for lightning-datatable.
     * Behavior:
     * - Extracts the raw message from the Apex AuraHandledException.
     * - Splits the message into individual error blocks using the double-newline ("\n\n") delimiter.
     * - Parses each block using the "Title|||Message" format.
     * - Identifies affected records by scanning the message body for Contract Names (e.g., C-9060000033-2).
     * - Matches identified Contract Names to Record IDs via the selectedRecords collection.
     * - Maps specific keywords to datatable column field names for cell-level highlighting.
     * - Constructs a "rows" object indexed by Record ID and a "table" object for the general error header.
     * @param {Object|string} error - The error object caught from the Apex imperative call.
     * @param {Array} selectedRecords - The collection of records currently selected in the datatable.
     * @returns {Object} A datatable-compatible error object containing 'rows' and 'table' properties.
     */
    static parseTableErrors(error, selectedRecords) {
        const rawMessage = error?.body?.message || error?.message || '';
        const errorStrings = rawMessage.split('\n\n');

        const rowErrors = {};
        const tableMessages = [];

        errorStrings.forEach(errStr => {
            if (!errStr.includes('|||')) return;

            const [title, body] = errStr.split('|||');
            tableMessages.push(title.trim());

            // Regex to find Contract Names (e.g., C-9060000033-2)
            const nameMatches = body.match(/C-[\w-]+/g);

            if (nameMatches && selectedRecords) {
                nameMatches.forEach(contractName => {
                    // Find the record in selectedRecords where Contract__r.Name matches the error string
                    const matchingRecord = selectedRecords.find(rec => rec.Contract__r?.Name === contractName);

                    if (matchingRecord) {
                        const recordId = matchingRecord.Id;

                        if (!rowErrors[recordId]) {
                            rowErrors[recordId] = {
                                title: [],
                                messages: [],
                                fieldNames: []
                            };
                        }

                        // Dynamically set row errors based on error title from apex
                        if (title.includes('Missing UOM')) {
                            rowErrors[recordId].messages.push('Selected pricing unit does not have a matching UOM record for this contract.');
                        } else if (title.includes('SAP Blocks')) {
                            rowErrors[recordId].messages.push(
                                "The selected contract has SAP blocks that prevent processing. Check this contract's product and product plant."
                            );
                        } else if (title.includes('Sales Agreement Type')) {
                            rowErrors[recordId].messages.push('Only "Fixed Pricing" sales agreement type contracts can be mass edited.');
                        } else if (title.includes('Freight Rate Type Mismatch')) {
                            rowErrors[recordId].messages.push('Only contracts with the same freight rate types are supported.');
                        } else if (title.includes('Negative Price or Freight Detected')) {
                            rowErrors[recordId].messages.push(
                                "This contract's unit price or freight change will result in a negative value with the changes you have entered. Please de-select this contract or change your input."
                            );
                        } else if (title.includes('Suggested Freight Detected')) {
                            rowErrors[recordId].messages.push(
                                "This contract's freight has been set by suggested freight lanes and therefore cannot be mass edited. Please de-select this contract or remove the freight change."
                            );
                        }

                        const errorTotal = rowErrors[recordId].messages.length;
                        const errorLabel = errorTotal === 1 ? 'error' : 'errors';
                        rowErrors[recordId].title = `We found ${errorTotal} ${errorLabel}.`;
                    }
                });
            }
        });

        return {
            rows: rowErrors,
            table: {
                title: 'Your entry cannot be saved. Fix the errors and try again.',
                messages: tableMessages
            }
        };
    }
}