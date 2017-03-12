const { execSync } = require( 'child_process' );
const sander = require( 'sander' );

const versions = require( '../versions.json' );

versions.forEach( version => {
	sander.writeFileSync( `versions/${version}/package.json`, JSON.stringify({
		dependencies: {
			svelte: version
		}
	}));

	execSync( `yarn`, {
		cwd: `versions/${version}`,
		stdio: 'inherit'
	});
});