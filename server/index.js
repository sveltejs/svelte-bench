const fs = require( 'fs' );
const path = require( 'path' );
const relative = require( 'require-relative' );
const express = require( 'express' );
const { rollup } = require( 'rollup' );

const app = express();

app.use( express.static( `public` ) );

app.listen( 3000, () => {
	console.log( `Listening on localhost:3000` );
});