var messageChannel = {};
var pushId = 0;
var pendingNotifications = {};

self.addEventListener('install', function(event) {
    self.skipWaiting();
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
        obj = event.data.json();
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
    if (typeof(pushData.tag) === "undefined") {
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
        setTimeout(function() {
            resolve();
        },200);
    });

    event.waitUntil(
        delayPromise.then(function(){
            if (typeof(pendingNotifications[pushData.pushId]) !== "undefined") {
                self.registration.showNotification(pushData.title, notificationOptions);
                delete (pendingNotifications[pushData.pushId]);
            }
        })
    );
    if (!pushData['content_available']) {
        pendingNotifications[pushData.pushId] = true;
    }
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
        // Add timeout & cancelation like in notification
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
