module.exports = function(context) {
    console.log('Updating SENDER_ID for browser platform...');
	var fs = require('fs');
    var path = require('path');
	var senderIdValue = '';
	var children = context.opts.plugin.pluginInfo._et._root._children;
	for (var i = 0; i < children.length; i++) {
		if (children[i].tag == "preference" && children[i].attrib.name == "SENDER_ID") {
			senderIdValue = children[i].attrib.default;
			break;
		}
	}
	console.log('Default SENDER_ID: ' + senderIdValue);
	process.argv.forEach(function (val, index, array) {
		if (val == "--variable") {
			if (array.length > index+1 && array[index+1].indexOf("SENDER_ID") == 0) {
				senderIdValue = array[index+1].substring(array[index+1].indexOf("=") + 1);
			}
		}
	});	
	console.log('Detected SENDER_ID: ' + senderIdValue);
	
	var manifestContent = fs.readFileSync(path.join(context.opts.plugin.dir, 'src/browser/manifest.json'), 'utf-8');
	manifestContent = manifestContent.replace("$SENDER_ID", senderIdValue);
	fs.writeFileSync(path.join(context.opts.plugin.dir, 'src/browser/modified-manifest.json'), manifestContent, 'utf-8');
	console.log("Updated SENDER_ID for browser platform");
}
