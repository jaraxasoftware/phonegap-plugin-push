var messageChannel = {};
var pushId = 0;
var pendingNotifications = {};
var clearSilentNotificationTimeout = null;

self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
    // parse incoming message
    var obj = {};
    var pushData = {
        image: 'https://avatars1.githubusercontent.com/u/60365?v=3&s=200',
        additionalData: {}
    };
    if (event.data) {
        try {
            obj = event.data.json();
        } catch (e) {
            console.error(e);
        }
    }  

    // convert to push plugin API
    for (var key in obj) {
        if (key === 'title') {
            pushData.title = obj[key];
        } else if (key === 'message' || key === 'body') {
            pushData.message = obj[key];
        } else if (key === 'count' || key === 'msgcnt' || key === 'badge') {
            pushData.count = obj[key];
        } else if (key === 'sound' || key === 'soundname') {
            pushData.sound = obj[key];
        } else if (key === 'image') {
            pushData.image = obj[key];
        } else if (key === 'content_available') {
            pushData['content_available'] = obj[key];
        } else if (key === 'tag') {
            pushData.tag = obj[key];
        } else if (key === 'url') {
            pushData.url = obj[key];
        } else {
            pushData.additionalData[key] = obj[key];
        }
    }
    pushData.pushId = pushId++;
    if (pushData['content_available']) {
        pushData.tag = "silent---notification";
    } else if (typeof(pushData.tag) === "undefined") {
        pushData.tag = "tag-" + pushData.pushId;
    }
    var notificationOptions = {
        body: pushData.message,
        icon: pushData.image,
        tag: pushData.tag,
        data: pushData
    };

    // Add when available in browsers
    /*if (typeof(pushData.sound) !== "undefined") {
        notificationOptions.sound = pushData.sound;
    }*/

    var delayPromise = new Promise(function(resolve, reject) {
        clients.matchAll({
            type: "window"
        }).then(function(clientList) {
            var isVisible = false;
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.visibilityState == "visible") {
                    isVisible = true;
                }
            }
            if (!isVisible) {
                setTimeout(function() {
                    if (typeof(pendingNotifications[pushData.pushId]) !== "undefined") {
                        self.registration.showNotification(pushData.title, notificationOptions).then(function() {
                            delete (pendingNotifications[pushData.pushId]);
                            resolve(true);
                        });
                    } else {
                        self.registration.showNotification(pushData.title, notificationOptions).then(function() {
                            var times = 0;
                            if (clearSilentNotificationTimeout != null) {
                                clearTimeout(clearSilentNotificationTimeout);
                                clearSilentNotificationTimeout = null;
                            }
                            clearSilentNotificationTimeout = setTimeout(function() {
                                self.registration.getNotifications({tag: pushData.tag}).then(function(notifications) {
                                    for (var i = 0; i < notifications.length; i++) {
                                        var notification = notifications[i];
                                        if (notification.tag == pushData.tag || !notification.tag) {
                                            notification.close();
                                            clearSilentNotificationTimeout = null;
                                        }
                                    }
                                });
                            }, 100);
                            resolve(false);
                        });
                    }
                },200);
            } else {
                setTimeout(function() {
                    if (typeof(pendingNotifications[pushData.pushId]) !== "undefined") {
                        self.registration.showNotification(pushData.title, notificationOptions).then(function() {
                            delete (pendingNotifications[pushData.pushId]);
                            resolve(true);
                        });
                    } else {
                        resolve(false);
                    }
                },200);
            }
        });
    });

    if (!pushData['content_available']) {
        pendingNotifications[pushData.pushId] = true;
    }
    event.waitUntil(delayPromise);
    for (var windowid in messageChannel) {
        messageChannel[windowid].ports[0].postMessage({
            cmd: 'notification',
            data: pushData
        });
    }
});

self.addEventListener('message', function(event) {
    if (event.data.cmd == "init") {
        messageChannel[event.data.windowid] = event;
    } else if (event.data.cmd == "received") {
        delete (pendingNotifications[event.data.pushId]);
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var pushData = event.notification.data;

    for (var windowid in messageChannel) {
        messageChannel[windowid].ports[0].postMessage({
            cmd: 'notificationclick',
            data: pushData
        });
    }
    event.waitUntil(clients.matchAll({
        type: "window"
    }).then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            return client.focus();
        }
        if (clients.openWindow && pushData.url) {
            return clients.openWindow(pushData.url);
        }
    }));
});
