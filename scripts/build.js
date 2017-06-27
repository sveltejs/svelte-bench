const { build } = require('./build-tools');

const versions = require( '../versions.json' );

versions.forEach( version => {
	const dir = `versions/${version}`;
	build( version, dir );
});