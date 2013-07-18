Tryton Titanium Module
======================

This Titanium commonJS Module is used to communicate with a running Tryton
Server.

Licensed under BSD-3

Quick Usage Examples
====================

To use this module in your Titanium Project, drag it to the /lib/ folder under
your /app/ directory, and in your controller file.

```javascript
var trytonClient = require('trytonClient');
```

Accessing a model

```javascript
var model = trytonClient.getModel('party');
```

To perform a search & read on this model

```javascript
model.searchRead({
    domain: [['name', '=', 'party']],
    fields_names: [['name', 'address']],
    callback: function(response){
        // handle response
    }
});
```

Generating Documentation
========================

To generate documentation for this project, ensure you have
[yuidoc](http://yui.github.io/yuidoc/) installed. Run the following command
in your terminal from the root directory of the Tryton Titanium Module:

    yuidoc .
