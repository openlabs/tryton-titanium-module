/*
 * Tryton Titanium Module v1.0
 * This file is part of
 * tryton-titanium-module.  The
 * COPYRIGHT file at the top level of
 * this repository contains the full
 * copyright notices and license terms.
 *
 * Unpublished Copyright
 * © 2013 Openlabs Technologies &
 * Consulting (P) Limited
 * All Rights Reserved.
 *
 */

/*
 * TODO: Understand if Number is
 * sufficient or a new class need to be
 * implemented for this to work
 *
 */
Decimal = Number;

/**
 * JSON object sent by Tryton server
 * includes several non encodable
 * objects, which are converted to
 * simpler JSON objects. This
 * method, parses a response object from
 * the server side to a flat
 * JSON object with local JS data types.
 *
 * @method convertJSONObject
 *
 */
var convertJSONObject = function(value, index, parent) {"use strict";
    var i, length, p;
    if ( value instanceof Array) {
        // If the response is an array, possible
        // for a read
        // of multiple ids, convert each
        // individual object
        for ( i = 0, length = value.length; i < length; i = i + 1) {
            convertJSONObject(value[i], i, value);
        }
    } else if (
            ( typeof (value) !== 'string') && ( typeof (value) !== 'number')
                && (value !== null)) {
        if (value && value.__class__) {
            // All complex objects sent from the
            // server side
            // has a __class__ attribute which
            // indicates what
            // type of data was simplified.
            switch (value.__class__) {
                case 'datetime':
                    // datetime objects send all parts of it
                    // in UTC
                    value = new Date(Date.UTC(value.year, value.month - 1,
                        value.day, value.hour, value.minute, value.second));
                    break;
                case 'date':
                    value = new Date(value.year, value.month - 1, value.day);
                    break;
                case 'time':
                    throw new Error('Time support not implemented');
                case 'buffer':
                    value = Ti.Utils.base64decode(value.base64);
                    break;
                case 'Decimal':
                    value = Decimal(value.decimal);
                    break;
            }
            if (parent) {
                // This was a subobject of an array which
                // got converted
                // since they are mutable, replace the
                // parent inplace.
                parent[index] = value;
            }
        } else {
            // This is a JSON object, like a
            // dictionary.
            // convert each value into Simpler type
            for (p in value) {
                convertJSONObject(value[p], p, value);
            }
        }
    }
    return parent || value;
};

/**
 * Handler for client login timing out, it shows an alert box which
 * asks the user for his current password and then logs the user back in
 * @method handleNotLogged
 * @param _args: argguments dictionary given to the function
 * @param callback: callback function to be executed once login is done
 */
var handleNotLogged = function(_args, callback) {
    var dialog = Ti.UI.createAlertDialog({
        title : 'Session Expired',
        message : 'Please enter your password for the user ' +
            Ti.App.Properties.getString('username'),
        style : Ti.UI.iPhone.AlertDialogStyle.SECURE_TEXT_INPUT,
        buttonNames : ['CANCEL', 'OK']
    });
    dialog.addEventListener('click', function(e2) {
        // The index property of the button
        if (e2.index == 0) {
            // Tigger a logout event
            return;
        }
        exports.common.login(Ti.App.Properties.getString('database'),
            Ti.App.Properties.getString('username'), e2.text,
            function(response) {
            // This is called once a response for the
            // login is received
            // If the login succeeded, try whatever
            if (_args) {
                // The user_id and session may have
                // changed since the reason
                // why notlogged happened itself was the
                // expired session
                _args.params[0] = Ti.App.Properties.getInt('user_id');
                _args.params[1] = Ti.App.Properties.getString('session');
                return rpcCall(_args, callback);
            }
        })
        Ti.API.info('e.text: ' + e2.text + e2.type);

    });
    dialog.show();
};

/**
 * This is the core method which makes an HTTP Call using Titaniums HTTPClient
 * Class with the arguments supplied to it.
 *
 * @method rpcCall
 * @param _args: dictionary of arguments
 * callback: callback function to call once call has completed
 * @currentWindow: the currentWindow which must be enabled or disabled during
 * the request
 *
 */
var rpcCall = function(_args, callback, currentWindow) {"use strict";
    var host, port, client, scheme, url, database, response,
        currentWindow=currentWindow;
    client = Ti.Network.createHTTPClient({
        timeout : 5000 // in milliseconds
    });

    // Setting the boolean field for the
    // validation of the SSL Certificate on
    // the server to false, this is done so
    // that
    // on production, the app doesn't check
    // if the SSL Security certificate is
    // valid. I'm doing specifically for the
    // demo
    // tryton server which runs HTTPS
    client.validatesSecureCertificate = false;

    host = Ti.App.Properties.getString('host');
    port = Ti.App.Properties.getString('port');
    scheme = Ti.App.Properties.getString('scheme');
    // The database could be explicitly
    // passed as argument
    // by some function calls. Respect that
    // or fallback to
    // the database specified in properties
    // XXX: Some methods may not need
    // database at all,
    // what does getstring do when a property
    // does no exist ?
    database = _args.database || Ti.App.Properties.getString('database');
    // Prepare the connection.
    url = scheme + host + ':' + port;

    // enables or disables the current
    // screen, according to the state of the request
    client.onreadystatechange = function(e) {
        if (!currentWindow) {
            // There is no window, get the fuck out
            // of here
            return;
        } else {
            // The currentWindow is set to touch disabled
            // once the request is opened, and set to false
            // once the request is done
            if (client.readyState === 1) {
                currentWindow.touchEnabled = false;
            }
            if (client.readyState === 4) {
                currentWindow.touchEnabled = true;
            }
        }
    }

    if (database) {
        client.open("POST", url + '/' + database);
    } else {
        client.open("POST", url);
    }

    /**
    * Get the context in which the operation has to happen.
    *
    * The context by default is fetched on login and stored as
    * a Ti.App.Property (as a string, not object because it is
    * nested).
    *
    * In addition, each rpcCall may provide a context of its own
    * for the specific request.
    * This version of the client, sends the context in the rpcCall
    * if there is one, else it picks up the context from the
    * App.Property
    *
    */

    // Debug
    Ti.API.debug({
        params : _args.params,
        method : _args.method,
        url : url
    });

    // Send the request.
    client.send(JSON.stringify({
        params : _args.params,
        method : _args.method
    }));

    // Setup success callback
    client.onload = function(e) {
        // All the response is JSON, unless the
        // server you are talking to is
        // not Tryton
        Ti.API.debug(this.responseText);
        response = convertJSONObject(JSON.parse(this.responseText));
        // TODO: Check if the response was a
        // stack trace or UserError, UserWarning
        // Wonder what difference the response
        // would have
        if (response.error) {
            Ti.API.error(response.error);

            // Try handling the error if it is known
            if (response.error[0] === "NotLogged") {
                // This is raised when the session
                // expires.
                if (_args.method === "common.login") {
                    /*
                     * This will not trigger NotLogged event
                     * when this response is received
                     * on a login call.
                     * handling this also prevents the "An
                     * error ocurred" alert at the bottom
                     */
                    Ti.API.debug('failed login response');
                    return callback(response);
                } else {
                    handleNotLogged(_args, callback);
                    return;
                }
            } else if (response.error[0] === "UserError") {
                alert(response.error[1][0]);
            } else {
                // Since this is an error this app doesnt
                // know to handle,
                // just give up!
                alert("An error occured. Check server logs for details.");
            }
        }

        // Call the callback function with the
        // result.
        // The other attribute is id which is
        // used to map the request to response
        // in async calls, not sure if it is
        // needed
        callback(response.result);

    };
    client.onerror = function(e) {
        // This may happen because of a
        // communication failure
        // Handling this is a bad idea, just blow
        // up in the face
        // of the user :)
        alert("Oops! Communication failure to the configured server.");
        callback();
    };
};
/**
 * This class returns a common class to the 'require' object, and returns
 * various methods for the Tryton Client
 * @class common
 */
exports.common = {
    /**
     * Returns the version of server
     * @method serverVersion
     * @param {Function} callback function thats passed to the rpcCall
     * @param {Object} currentWindow the window from which the call is made
     */
    serverVersion : function(callback, currentWindow) {"use strict";
        return rpcCall({
            'method' : 'common.server.version',
            'params' : [null, null]
        }, callback, currentWindow);
    },
    /**
     * Returns the timezone of server
     * @method timezoneGet
     * @param {Function} callback function thats passed to the rpcCall
     * @param {Object} currentWindow the window from which the call is made
     */
    timezoneGet : function(callback, currentWindow) {"use strict";
        return rpcCall({
            'method' : 'common.timezone_get',
            'params' : [null, null]
        }, callback, currentWindow);
    },
    /**
     * Login to a database with the given
     * username and password
     *
     * Calls the callback with a valid
     * response if login succeeded
     * Or calls the callback with a false on
     * failed login
     * @method login
     * @param {String} database the database to login to
     * @param {String} username the username with which login has to be done
     * @param {String} password the password for the login
     * @param {Function} callback function to be executed after request is
     * complete
     * @param {Object} currentWindow window from which the function is called
     */
    login : function(database, username, password, callback, currentWindow){
        "use strict";
        var currentWindow = currentWindow;
        return rpcCall({
            'method' : 'common.login',
            'params' : [username, password],
            'database' : database
        }, function(login_response) {
            if (!login_response) {
                // Failed login. Just call the callback
                // with false
                callback(false);
                return;
            }
            Ti.App.Properties.setInt('user_id', login_response[0]);
            Ti.App.Properties.setString('session', login_response[1]);

            // Since the user has logged in, get his
            // preferences and set it on the context
            var resUserModel = exports.getModel('res.user');
            resUserModel.setWindowToDisable(currentWindow);
            // The argument true passed is to
            // indicate that only the context
            // needs to be returned and not all the
            // user's preferences
            resUserModel.makeRpcCall('get_preferences', [true],
                    function(context_response) {
                // Store the context as a string
                Ti.App.Properties.setString('context',
                    JSON.stringify(context_response));

                // Since the entire login process and
                // context getting is complete
                // call the callback with the login
                // response
                callback(login_response);
            });
        }, currentWindow);
    },
    /**
     * Check if the database exists.
     *
     * @method db_exist
     * @param {String} Database the database name which needs to be checked
     * @param {Function} Callback  the function which needs to be called after
     * request
     * @param {Object} CurrentWindowthe window from which the request is made
     */
    db_exist : function(database, callback, currentWindow) {"use strict";
        return rpcCall({
            'method' : 'common.db_exist',
            'params' : [username, password],
            'database' : database
        }, callback, currentWindow);
    },
    /**
     * List the databases on the server side.
     *
     * There is no guarantee that this works,
     * since tryton configuration
     * allows you to prevent database listing
     * or the database user may not
     * have rights to display databases
     *
     * @method list
     * @param {Function} callback callback from which the function is called
     * @param {Object} currentWindow window from which the request is made
     */
    list : function(callback, currentWindow) {"use strict";
        return rpcCall({
            'method' : 'common.list',
            'params' : [null, null]
        }, callback, currentWindow);
    },
    /**
     * Function to logout the user
     *
     * @method logout
     * @param {Function} callback function to call once call is completed
     * @param {Object} currentWindow window from which the request is made
     */
    logout : function(callback, currentWindow) {"use strict";
        var user = Ti.App.Properties.getString('user_id'),
            session = Ti.App.Properties.getString('session'),
            database = Ti.App.Properties.getString('database');
        return rpcCall({
            'method' : 'common.logout',
            'params' : [user, session],
            'database' : database
        }, callback, currentWindow);
    }
};
/**
 * Model API wrapper
 *refer: http://doc.tryton.org/2.8/trytond/doc/ref/models/models.html#modelsql
 *
 * @class modelProxy
 * @param name name of the model to which calls are going to be made
 */
var modelProxy = function(name) {"use strict";
    var model_name = name;
    /*
     * Set this instance variable if there is
     * a window which needs to be disabled
     */
    var windowToDisable = null;

    /**
     * This method is used for enabling or disabling the window from
     * which the call is being made
     *
     * @method setWindowToDisable
     * @param {Object} object of the window to disable during the call
     */
    this.setWindowToDisable = function(windowReference) {
        windowToDisable = windowReference;
    }

    /**
     * This method makes an RPC Call to the server
     *
     * @method makeRpcCall
     * @param {String} method name of the method you want to call on the model
     * @param {Object} args that have to be supplied
     * @param {Function} callback the callback function that needs to be called
     * @param {String} context the context of the call being made
     */
    this.makeRpcCall = function(method, args, callback, context) {
        var params = [Ti.App.Properties.getInt('user_id'),
            Ti.App.Properties.getString('session')];
        // TODO: If either of above are null,
        // throw up and take the
        // user to the login page

        // If a local context is provided use
        // that, or use context of the user
        context = context || JSON.parse(Ti.App.Properties.getString(
                    'context', '{}')
                );

        return rpcCall({
            'method' : 'model.' + model_name + '.' + method,
            'params' : params.concat(args, [context])
        }, callback, windowToDisable);
    };

    /**
     * Return a list of records that match
     * the domain.
     * @method search
     * @param {Array} domain the domain for which the request is being made
     * @param {Number} offset offset, self-explanatory
     * @param {Number} limit self-explanatory
     * @param {Number} order order, self-explanatory
     * @param {Number} count number of orders to be returned
     * @param {ObjecT} fields_names names of the fields that have to being
     * returned
     * @param {Function} callback the callback function for this request
     */
    this.search = function(_args) {
        return this.makeRpcCall('search', [
            _args.domain, _args.offset, _args.limit, _args.order, _args.count],
            _args.callback, _args.context);
    };

    /**
     * Call search() and read() at once.
     * Useful to reduce the number of calls.
     * @method searchRead
     * @param {Array} domain the domain for which the request is being made,
     * a List
     * @param {Number} offset offset, self-explanatory
     * @param {Number} limit self-explanatory
     * @param {Number} order order, self-explanatory
     * @param {Number} count number of orders to be returned
     * @param {Object} fields_names names of the fields that have to be
     * returned
     * @param {Function} callback the callback function for this request
     */
    this.searchRead = function(_args) {
        return this.makeRpcCall('search_read', [
            _args.domain, _args.offset, _args.limit,
            _args.order, _args.fields_names
        ], _args.callback, _args.context);
    };

    /**
     * This method is used to create a new record on the server.
     *
     * @method create
     * @param {Array} parameter list of values with which the object must been
     * created
     * @param {Function} callback callback function once the request has
     * completed
     * @param {Context} context context of the request
     */
    this.create = function(_args) {
        return this.makeRpcCall('create', [_args.parameter],
                _args.callback, _args.context);
    };

    /**
     * This method is used to write an existing record on the server,
     *
     * @method write
     * @param {Array} ids list of id in which the values have been written
     * @param {Object} parameter list of values with which the object must because
     * writtepo
     * @param {Function} callback callback function once the request has
     * completed
     * @param {String} context context of the request
     */

    this.write = function(_args) {
        return this.makeRpcCall('write', [_args.ids, _args.parameter],
                _args.callback, _args.context);
    };

    /**
     * This method is used to delete a record on the server, used this way
     * because delete is a reserved js keyword
     *
     * @method delete
     * @param {Array} ids id of object which has to be deleted
     * @param {Function} callback callback function once the request has
     * completed
     * @param {String} context context of the request
     */

    this['delete'] = function(_args) {
        return this.makeRpcCall('delete', [_args.ids], _args.callback, 
                _args.context);
    };

    return this;
}

exports.getModel = function(name) {
    return new modelProxy(name);
}
