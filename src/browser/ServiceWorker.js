var messageChannel;
var pushId = 0;
var pendingNotifications = {};

self.addEventListener('install', function(event) {
    self.skipWaiting();
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
        } else {
            pushData.additionalData[key] = obj[key];
        }
    }
    pushData.pushId = pushId++;

    var delayPromise = new Promise(function(resolve, reject) {
        setTimeout(function() {
            resolve();
        },200);
    });

    event.waitUntil(
        delayPromise.then(function(){
            if (typeof(pendingNotifications[pushData.pushId]) !== "undefined") {
                self.registration.showNotification(pushData.title, {
                    body: pushData.message,
                    icon: pushData.image,
                    tag: 'simple-push-demo-notification-tag'
                });
                delete (pendingNotifications[pushData.pushId]);
            }
        })
    );
    pendingNotifications[pushData.pushId] = true;
    if (typeof(messageChannel) != "undefined") {
        messageChannel.ports[0].postMessage(pushData);
    }

});

self.addEventListener('message', function(event) {
    if (event.data.cmd == "init") {
        messageChannel = event;
    } else if (event.data.cmd == "received") {
        delete (pendingNotifications[event.data.pushId]);
    }
});
