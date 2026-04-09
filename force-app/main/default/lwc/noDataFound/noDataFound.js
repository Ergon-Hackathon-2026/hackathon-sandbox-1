import { LightningElement, api } from 'lwc';

export default class NoDataFound extends LightningElement {
    @api title = 'No records found';
    @api subtitle = 'There are no records to display at this time.';
    @api buttonIconName = '';
    @api size = 'small'; // small, medium, large
    @api showButton = false;
    @api buttonLabel = 'Take Action';
    @api buttonVariant = 'brand';

    get illustrationClasses() {
        return 'slds-illustration slds-illustration_' + this.size;
    }

    get hasSubtitle() {
        return this.subtitle && this.subtitle.trim() !== '';
    }

    get hasTitle() {
        return this.title && this.title.trim() !== '';
    }

    handleButtonClick() {
        // Dispatch a custom event that parent components can listen to
        this.dispatchEvent(
            new CustomEvent('buttonclick', {
                detail: {
                    action: 'button_clicked'
                }
            })
        );
    }
}