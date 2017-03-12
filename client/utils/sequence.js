export default function sequence ( array, fn ) {
	return array.reduce( ( promise, item ) => {
		return promise.then( () => Promise.resolve( fn( item ) ) );
	}, Promise.resolve() );
}