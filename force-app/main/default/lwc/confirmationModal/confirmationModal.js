import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export default class ConfirmationModal extends LightningModal {
    @api title = 'Confirm Action';
    @api message = 'Are you sure you want to proceed?';
    @api buttonVariant = 'brand';
    @api buttonIcon = 'utility:check';
    @api buttonLabel = 'Approve';
    @api isProcessing = false;

    handleCancel() {
        this.close('cancel');
    }

    handleConfirm() {
        this.close('confirm');
    }
}