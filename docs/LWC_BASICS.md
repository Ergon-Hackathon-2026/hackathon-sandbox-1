# Lightning Web Components (LWC) – Beginner Reference Guide

## Introduction to LWC

Lightning Web Components (LWC) is a modern JavaScript framework developed by Salesforce to build user interfaces on the Salesforce platform.

LWC is built using:

- HTML (Structure)
- JavaScript (Logic)
- CSS (Styling)
- Configuration file (`.js-meta.xml`)

---

## Basic LWC Component Structure

Every LWC component contains at least the following files. LWC follows camelCase naming convention for component names.

### Naming Rules

- Component folder name must be in camelCase.
- File names must exactly match the folder name.
- The JavaScript class name should be in PascalCase.

### Example: `myComponent`

```text
myComponent.html
myComponent.js
myComponent.js-meta.xml
myComponent.css (optional)
```

---

## What is HTML in LWC?

The HTML file defines the structure (UI) of the component.

### Example

```html
<template>
    <h1>Welcome to LWC</h1>
    <p>{message}</p>
</template>
```

---

### Important Points

- The `<template>` tag is mandatory.
- `{message}` is called data binding.
- It displays values from the JavaScript file.

---

## JavaScript File (`myComponent.js`)

The JavaScript file contains logic and properties.

### Basic Structure

```javascript
import { LightningElement } from 'lwc';

export default class MyComponent extends LightningElement {
    message = 'Hello World';
}
```

### Explanation

- `LightningElement` is the base class for all LWC components.
- `export default` allows the component to be used by Salesforce.

---

## Important Decorators in LWC

Decorators are special functions used to modify properties or methods.

### `@track`

Used to make properties reactive (mainly for objects and arrays).

```javascript
import { LightningElement, track } from 'lwc';

export default class Example extends LightningElement {
    @track name = 'Ergon Inc';
}
```

When the value changes, the HTML automatically updates.

> Note: For primitive types (String, Number, Boolean), `@track` is not required in modern LWC.

---

### `@api`

Used to expose properties or methods to parent components.

```javascript
import { LightningElement, api } from 'lwc';

export default class ChildComponent extends LightningElement {
    @api recordId;
}
```

This allows a parent component to pass data to the child.

---

### `@wire`

Used to connect to Salesforce data (Apex methods or Lightning Data Service).

```javascript
import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

export default class AccountList extends LightningElement {
    @wire(getAccounts)
    accounts;
}
```

`@wire` automatically fetches data from Salesforce.

---

## Data Binding in LWC

### One-way Data Binding (JavaScript → HTML)

HTML:

```html
<p>{message}</p>
```

JavaScript:

```javascript
message = 'Hello LWC';
```

### Explanation

- `{message}` displays the value from JavaScript.
- If `message` changes, the UI updates automatically.
- This is called reactive binding.

---

## Property Binding (Binding Value to Input)

HTML:

```html
<lightning-input value={name}></lightning-input>
```

JavaScript:

```javascript
name = 'Ergon Inc';
```

### Explanation

- `value={name}` binds the JS variable to the input field.
- The input initially shows “Ergon Inc”.
- This is still one-way binding (JS → HTML).

---

## Two-Way Interaction (Using Events)

JavaScript:

```javascript
name = '';

handleChange(event) {
    this.name = event.target.value;
}
```

HTML:

```html
<lightning-input onchange={handleChange}></lightning-input>
<p>{name}</p>
```

### Explanation

- `onchange` calls the JS method.
- `event.target.value` gets user input.
- `{name}` updates in HTML.
- This behaves like two-way binding.

---

## Conditional Rendering

HTML:

```html
<template if:true={isVisible}>
    <p>Visible Content</p>
</template>
```

JavaScript:

```javascript
isVisible = true;
```

### Explanation

- `if:true` checks the value.
- If `isVisible = true`, content shows.
- If `isVisible = false`, content hides.
- Used to show/hide sections dynamically.

---

## Looping in LWC

HTML:

```html
<template for:each={fruits} for:item="fruit">
    <p key={fruit}>{fruit}</p>
</template>
```

JavaScript:

```javascript
fruits = ['Apple', 'Mango', 'Orange'];
```

### Explanation

- `for:each` loops through arrays.
- `for:item="fruit"` represents each item.
- `key` is mandatory in loops.
- This prints all fruits.

---

## Event Handling

HTML:

```html
<lightning-button label="Click Me" onclick={handleClick}></lightning-button>
<p>{message}</p>
```

JavaScript:

```javascript
message = 'Hello';

handleClick() {
    this.message = 'Button Clicked';
}
```

### Explanation

- `onclick` calls `handleClick()`.
- When button is clicked, message changes.
- `{message}` updates automatically.

---

## CSS in LWC

The CSS file automatically applies to the component.

Example:

```css
p {
    color: blue;
    font-size: 18px;
}
```

### Explanation

- CSS is scoped to the component.
- It won’t affect other components.
- No need to import CSS manually.

---

## Meta XML File (`myComponent.js-meta.xml`)

This file defines where the component can be used.

Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
    </targets>
</LightningComponentBundle>
```

### Explanation

- `isExposed = true` → component visible in App Builder.
- `targets` → where you can use the component.
- Without this file, the component won’t appear in the UI.

---

## Lifecycle Hooks

### `connectedCallback()`

Runs when the component is inserted into the DOM.

```javascript
connectedCallback() {
    console.log('Component Loaded');
}
```

---

### `renderedCallback()`

Runs after the component is rendered.

```javascript
renderedCallback() {
    console.log('Component Rendered');
}
```

---

## Calling Apex Imperatively

```javascript
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

handleLoad() {
    getAccounts()
        .then(result => {
            this.accounts = result;
        })
        .catch(error => {
            console.error(error);
        });
}
```

### Explanation

- Calls Apex method manually.
- `.then()` runs when data is returned.
- `.catch()` runs if an error occurs.
- Used when fetching data on button click.
