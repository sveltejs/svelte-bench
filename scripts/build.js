const path = require( 'path' );
const sander = require( 'sander' );
const relative = require( 'require-relative' );
const { rollup } = require( 'rollup' );
const buble = require( 'rollup-plugin-buble' );
const UglifyJS = require( 'uglify-js' );
const zlib = require( 'zlib' );

const versions = require( '../versions.json' );
const benchmarks = sander.readdirSync( 'benchmarks' ).filter( d => d[0] !== '.' );

let promise = Promise.resolve();

versions.forEach( version => {
	const dir = `versions/${version}`;
	const svelte = relative( 'svelte', dir );

	benchmarks.forEach( benchmark => {
		promise = promise.then( () => {
			const dest = `public/benchmarks/${benchmark}/${version}`;

			return sander.exists( dest ).then( exists => {
				if ( exists ) return;

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
						},
						buble()
					]
				}).then( bundle => {
					return bundle.generate({
						format: 'iife',
						moduleName: 'Component'
					}).code;
				}, err => {
					console.error( err.message );
					return `window.error = ${JSON.stringify( err.message )};`;
				})
				.then( code => {
					const minified = UglifyJS.minify( code, { fromString: true });
					const zipped = zlib.gzipSync( minified.code );

					return Promise.all([
						sander.writeFile( `${dest}/component.js`, code ),
						sander.writeFile( `${dest}/index.html`, `
							<!doctype html>
							<html>
							<head>
								<meta charset='utf-8'>
								<meta name='viewport' content='width=device-width'>

								<title>${benchmark}/${version}</title>

								<style>
									body {
										font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
									}
								</style>
							</head>
							<body>
								<h1>${benchmark}/${version}</h1>
								<button>run</button>
								<main></main>
								<script src='component.js'></script>
								<script>
									var component = new Component({
										target: document.querySelector( 'main' )
									});

									var button = document.querySelector( 'button' );

									if ( component.run ) {
										button.addEventListener( 'click', function () {
											component.run();
										});
									} else {
										button.disabled = true;
									}
								</script>
							</body>
							</html>` ),
						sander.writeFile( `${dest}/component.json`, JSON.stringify({
							code,
							size: zipped.length
						}))
					]);
				});
			});
		});
	});
});