import fs from 'fs';
import replace from 'rollup-plugin-replace';
import svelte from 'rollup-plugin-svelte';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

// TODO should this list be automatically generated somehow?
const versions = require( './versions.json' );

const benchmarks = fs.readdirSync( 'benchmarks' ).filter( d => d[0] !== '.' );

export default {
	entry: 'client/main.js',
	dest: 'public/bundle.js',
	format: 'iife',
	sourceMap: true,
	plugins: [
		resolve(),
		commonjs(),
		replace({
			__BENCHMARKS__: JSON.stringify( benchmarks ),
			__VERSIONS__: JSON.stringify( versions )
		}),
		svelte()
	]
};