const path = require( 'path' );
const sander = require( 'sander' );
const relative = require( 'require-relative' );
const { rollup } = require( 'rollup' );

const versions = require( '../versions.json' );
const benchmarks = sander.readdirSync( 'benchmarks' ).filter( d => d[0] !== '.' );

let promise = Promise.resolve();

versions.forEach( version => {
	const dir = `versions/${version}`;
	const svelte = relative( 'svelte', dir );

	benchmarks.forEach( benchmark => {
		promise = promise.then( () => {
			const dest = `public/benchmarks/${benchmark}/${version}.js`;

			console.log( `creating ${dest}` );

			return rollup({
				entry: `benchmarks/${benchmark}/Main.html`,
				plugins: [
					{
						name: 'svelte',

						transform ( code, id ) {
							if ( !/\.html$/.test( id ) ) { return null; }

							const name = path.basename( id ).replace( /\.html$/, '' );

							return svelte.compile( code, {
								name,
								filename: id,
								format: 'es',
								shared: relative.resolve( 'svelte/shared.js', dir ),

								onerror ( err ) {
									let message = ( err.loc ? `(${err.loc.line}:${err.loc.column}) ` : '' ) + err.message;
									if ( err.frame ) message += `\n${err.frame}`;

									const err2 = new Error( message );
									err2.stack = err.stack;

									throw err2;
								}
							});
						}
					}
				]
			}).then( bundle => {
				return bundle.write({
					dest,
					format: 'iife',
					moduleName: 'Component'
				});
			}, err => {
				console.error( err.message );
				const code = `window.error = ${JSON.stringify( err.message )};`;
				return sander.writeFile( dest, code );
			});
		});
	});
});