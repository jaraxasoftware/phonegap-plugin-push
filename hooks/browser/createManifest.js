module.exports = function(context) {
    console.log('Updating SENDER_ID for browser platform...');
	var fs = require('fs');
    var path = require('path');
	console.log(JSON.stringify(context.opts));
	
	var manifestContent = fs.readFileSync(path.join(context.opts.plugin.dir, 'src/browser/manifest.json'), 'utf-8');
	manifestContent = manifestContent.replace("$SENDER_ID", "test");
	console.log(manifestContent);	
}
