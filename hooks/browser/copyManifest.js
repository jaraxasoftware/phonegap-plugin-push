module.exports = function(context) {
    console.log('Copying manifest.json for browser platform...');
	var fs = require('fs');
    var path = require('path');
	
	var manifestContent = fs.readFileSync(path.join(context.opts.plugin.dir, 'src/browser/modified-manifest.json'), 'utf-8');
	fs.writeFileSync(path.join(context.opts.projectRoot, 'platforms/browser/www/manifest.json'), manifestContent, 'utf-8');
	console.log("Copied manifest.json");
}
