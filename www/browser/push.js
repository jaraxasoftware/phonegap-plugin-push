/* global cordova:false */
/* globals window, document, navigator */

/*!
 * Module dependencies.
 */

var exec = cordova.require('cordova/exec');

/**
 * PushNotification constructor.
 *
 * @param {Object} options to initiate Push Notifications.
 * @return {PushNotification} instance that can be monitored and cancelled.
 */
var serviceWorker, subscription;
var notificationCanceled = false;
var keepChannelAliveTimeout = null;
var PushNotification = function(options) {
    this._handlers = {
        'registration': [],
        'notification': [],
        'notificationclick': [],
        'error': []
    };

    // require options parameter
    if (typeof options === 'undefined') {
        throw new Error('The options argument is required.');
    }

    // store the options to this object instance
    this.options = options;
    
	// subscription options
    var subOptions = {userVisibleOnly: true};
	this.browserOptions = this.options.browser || {}
    if (this.browserOptions.applicationServerKey) {
      subOptions.applicationServerKey = urlBase64ToUint8Array(this.browserOptions.applicationServerKey);
    }	

    // triggered on registration and notification
    var that = this;
    var windowGuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });

    // Add manifest.json to main HTML file
    var linkElement = document.createElement('link');
    linkElement.rel = 'manifest';
	if (this.browserOptions.manifestUrl) {
		linkElement.href = this.browserOptions.manifestUrl;
	} else {
		linkElement.href = 'manifest.json';
	}
    document.getElementsByTagName('head')[0].appendChild(linkElement);

    var MAX_RETRIES = 3;

    function installServiceWorker(retry) {
        if (retry <= MAX_RETRIES) {
            if ('serviceWorker' in navigator && 'MessageChannel' in window) {
                var result;

                navigator.serviceWorker.register('ServiceWorker.js').then(function(reg) {
                    var serviceWorker;
                    if (reg.installing) {
                        serviceWorker = reg.installing;
                    } else if (reg.waiting) {
                        serviceWorker = reg.waiting;
                    } else if (reg.active) {
                        serviceWorker = reg.active;
                    }
                    serviceWorker.addEventListener('statechange', function(event) {
                        if (event.target.state === "redundant") {
                            if (retry < MAX_RETRIES) {
                                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                                    for (var i=0; i<registrations.length; i++) {
                                        registrations[i].unregister();
                                    }
                                    installServiceWorker(retry + 1);
                                });
                            }
                        }
                    });
                    return navigator.serviceWorker.ready;
                })
                .then(function(reg) {
                    reg.pushManager.subscribe(subOptions).then(function(sub) {
                        subscription = sub;
                        var jsonSub = JSON.parse(JSON.stringify(subscription));
                        var result = {
                            endpoint: sub.endpoint,
                            key: jsonSub.keys['p256dh'],
                            auth: jsonSub.keys['auth']
                        };
                        var registrationId = JSON.stringify(result);
                        result['registrationId'] = registrationId;
                        that.emit('registration', result);
                    }).catch(function(error) {
                        if (navigator.serviceWorker.controller === null) {
                            // When you first register a SW, need a page reload to handle network operations
                            window.location.reload();
                            return;
                        }
                        reg.pushManager.getSubscription().then(function(sub) {
                            if (sub != null) {
                                console.log("Already subscribed", sub);
                                return sub.unsubscribe();
                            } else {
                                console.log("Not subscribed");
                                return true;
                            }
                        }).then(function(ok) {
                            if (ok) {
                                installServiceWorker(retry + 1);
                            } else {
                                throw error;
                            }
                        });

                        //throw new Error('Error subscribing for Push notifications.');
                        //throw error;
                    });
                    var serviceWorker;
                    if (reg.installing) {
                        serviceWorker = reg.installing;
                    } else if (reg.waiting) {
                        serviceWorker = reg.waiting;
                    } else if (reg.active) {
                        serviceWorker = reg.active;
                    }
                    if (keepChannelAliveTimeout != null) {
                        window.clearTimeout(keepChannelAliveTimeout);
                    }
                    keepChannelAliveTimeout = window.setInterval(function(){
                        var channel = new MessageChannel();
                        serviceWorker.postMessage({cmd: 'init', windowid: windowGuid}, [channel.port2]);
                        channel.port1.onmessage = function(e) {
                            var cmd = e.data.cmd;
                            var data = e.data.data;
                            if (cmd == 'notification') {
                                if (typeof(data.sound) !== "undefined" && !data["content_available"]) {
                                    try {
                                        var audio = new Audio(data.sound);
                                        audio.play();
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                var channel = new MessageChannel();
                                notificationCanceled = false;
                                that.emit('notification', data);
                                if (notificationCanceled) {
                                    serviceWorker.postMessage({cmd: 'received', pushId: data.pushId}, [channel.port2]);
                                }
                            } else if (cmd == 'notificationclick') {
                                that.emit('notificationclick', data);
                            }
                        }
                    },5000);
                }).catch(function(error) {
                    console.log(error);
                    throw new Error('Error registering Service Worker');
                });
            } else {
                throw new Error('Service Workers are not supported on your browser.');
            }        
        } else {
            throw new Error('Service Worker cannot be installed. Maybe using private navigation mode.');
        }
    }

    installServiceWorker(1);
};
    
/**
 * Cancel showing current notification
 */

PushNotification.prototype.cancelNotification = function(successCallback, errorCallback) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.cancelNotification failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.cancelNotification failure: success callback parameter must be a function');
        return;
    }
    notificationCanceled = true;
	successCallback();
}

/**
 * Unregister from push notifications
 */

PushNotification.prototype.unregister = function(successCallback, errorCallback, options) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.unregister failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.unregister failure: success callback parameter must be a function');
        return;
    }

    var that = this;
    if (!options) {
        that._handlers = {
            'registration': [],
            'notification': [],
            'notificationclick': [],
            'error': []
        };
    }

    if (serviceWorker) {
        serviceWorker.unregister().then(function(isSuccess) {
            if (isSuccess) {
                successCallback();
            } else {
                errorCallback();
            }
        });
    }
};

/**
 * subscribe to a topic
 * @param   {String}      topic               topic to subscribe
 * @param   {Function}    successCallback     success callback
 * @param   {Function}    errorCallback       error callback
 * @return  {void}
 */
PushNotification.prototype.subscribe = function(topic, successCallback, errorCallback) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.subscribe failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.subscribe failure: success callback parameter must be a function');
        return;
    }

    successCallback();
};

/**
 * unsubscribe to a topic
 * @param   {String}      topic               topic to unsubscribe
 * @param   {Function}    successCallback     success callback
 * @param   {Function}    errorCallback       error callback
 * @return  {void}
 */
PushNotification.prototype.unsubscribe = function(topic, successCallback, errorCallback) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.unsubscribe failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.unsubscribe failure: success callback parameter must be a function');
        return;
    }

    successCallback();
};

/**
 * Call this to set the application icon badge
 */

PushNotification.prototype.setApplicationIconBadgeNumber = function(successCallback, errorCallback, badge) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.setApplicationIconBadgeNumber failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.setApplicationIconBadgeNumber failure: success callback parameter must be a function');
        return;
    }

    successCallback();
};

/**
 * Get the application icon badge
 */

PushNotification.prototype.getApplicationIconBadgeNumber = function(successCallback, errorCallback) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.getApplicationIconBadgeNumber failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.getApplicationIconBadgeNumber failure: success callback parameter must be a function');
        return;
    }

    successCallback();
};

/**
 * Get the application icon badge
 */

PushNotification.prototype.clearAllNotifications = function(successCallback, errorCallback) {
    if (!errorCallback) { errorCallback = function() {}; }

    if (typeof errorCallback !== 'function')  {
        console.log('PushNotification.clearAllNotifications failure: failure parameter not a function');
        return;
    }

    if (typeof successCallback !== 'function') {
        console.log('PushNotification.clearAllNotifications failure: success callback parameter must be a function');
        return;
    }

    successCallback();
};

/**
 * Listen for an event.
 *
 * The following events are supported:
 *
 *   - registration
 *   - notification
 *   - error
 *
 * @param {String} eventName to subscribe to.
 * @param {Function} callback triggered on the event.
 */

PushNotification.prototype.on = function(eventName, callback) {
    if (this._handlers.hasOwnProperty(eventName)) {
        this._handlers[eventName].push(callback);
    }
};

/**
 * Remove event listener.
 *
 * @param {String} eventName to match subscription.
 * @param {Function} handle function associated with event.
 */

PushNotification.prototype.off = function (eventName, handle) {
    if (this._handlers.hasOwnProperty(eventName)) {
        var handleIndex = this._handlers[eventName].indexOf(handle);
        if (handleIndex >= 0) {
            this._handlers[eventName].splice(handleIndex, 1);
        }
    }
};

/**
 * Emit an event.
 *
 * This is intended for internal use only.
 *
 * @param {String} eventName is the event to trigger.
 * @param {*} all arguments are passed to the event listeners.
 *
 * @return {Boolean} is true when the event is triggered otherwise false.
 */

PushNotification.prototype.emit = function() {
    var args = Array.prototype.slice.call(arguments);
    var eventName = args.shift();

    if (!this._handlers.hasOwnProperty(eventName)) {
        return false;
    }

    for (var i = 0, length = this._handlers[eventName].length; i < length; i++) {
        var callback = this._handlers[eventName][i];
        if (typeof callback === 'function') {
            callback.apply(undefined,args);
        } else {
            console.log('event handler: ' + eventName + ' must be a function');
        }
    }

    return true;
};

PushNotification.prototype.finish = function(successCallback, errorCallback, id) {
    if (!successCallback) { successCallback = function() {}; }
    if (!errorCallback) { errorCallback = function() {}; }
    if (!id) { id = 'handler'; }

    if (typeof successCallback !== 'function') {
        console.log('finish failure: success callback parameter must be a function');
        return;
    }

    if (typeof errorCallback !== 'function')  {
        console.log('finish failure: failure parameter not a function');
        return;
    }

    successCallback();
};

/*!
 * Push Notification Plugin.
 */

/**
 * Converts the server key to an Uint8Array
 *
 * @param base64String
 *
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
 
module.exports = {
    /**
     * Register for Push Notifications.
     *
     * This method will instantiate a new copy of the PushNotification object
     * and start the registration process.
     *
     * @param {Object} options
     * @return {PushNotification} instance
     */

    init: function(options) {
        return new PushNotification(options);
    },

    hasPermission: function(successCallback, errorCallback) {
        const granted = Notification && Notification.permission === 'granted';
        successCallback({
            isEnabled: granted
        });
    },

    unregister: function(successCallback, errorCallback, options) {
        PushNotification.unregister(successCallback, errorCallback, options);
    },

    /**
     * PushNotification Object.
     *
     * Expose the PushNotification object for direct use
     * and testing. Typically, you should use the
     * .init helper method.
     */

    PushNotification: PushNotification
};
