import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAvailableObjects from '@salesforce/apex/QueryLibraryController.getAvailableObjects';
import getUsefulQueries from '@salesforce/apex/QueryLibraryController.getUsefulQueries';

export default class UsefulQueries extends LightningElement {
    queryRecords = [];
    objectOptions = [];
    error;
    objectOptionsError;
    loading = false;
    wiredQueriesResult;

    @wire(getUsefulQueries)
    wiredRecords(result) {
        this.wiredQueriesResult = result;
        this.loading = true;
        const { error, data } = result;

        if (data) {
            this.queryRecords = data;
            this.error = undefined;
        }

        if (error) {
            this.error = error;
        }

        this.loading = false;
    }

    @wire(getAvailableObjects)
    wiredAvailableObjects({ error, data }) {
        if (data) {
            this.objectOptions = data.map(option => ({
                label: option.label,
                value: option.value,
                description: option.value
            }));
            this.objectOptionsError = undefined;
        }

        if (error) {
            this.objectOptions = [];
            this.objectOptionsError = error;
        }
    }

    async handleQueryChange() {
        if (this.wiredQueriesResult) {
            this.loading = true;
            await refreshApex(this.wiredQueriesResult);
        }
    }
}