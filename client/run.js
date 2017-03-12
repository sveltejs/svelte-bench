/*global Component */
export function createAndDestroy () {
	if ( window.error ) {
		window.opener.postMessage({
			type: 'error',
			message: window.error
		}, '*' );

		window.opener.postMessage({
			type: 'done'
		}, '*' );

		return;
	}

	const now = () => window.performance.now();
	const wait = window.setImmediate ?
		() => new Promise( fulfil => setImmediate( fulfil ) ) :
		() => new Promise( fulfil => setTimeout( fulfil, 0 ) );

	function runCold () {
		let component;

		return Promise.resolve()
			.then( () => {
				// component create
				const t = now();
				component = new Component({
					target: document.body
				});
				const duration = now() - t;

				window.opener.postMessage({
					type: 'create:cold',
					value: duration
				}, '*' );
			})
			.then( wait )
			.then( () => {
				// component run
				let duration = 0;

				if ( component.run ) {
					const t = now();
					component.run();
					duration = now() - t;
				}

				window.opener.postMessage({
					type: 'run:cold',
					value: duration
				}, '*' );
			})
			.then( wait )
			.then( () => {
				// component destroy
				const t = now();
				if ( component.destroy ) {
					component.destroy();
				} else {
					component.teardown();
				}
				const duration = now() - t;

				window.opener.postMessage({
					type: 'destroy:cold',
					value: duration
				}, '*' );
			});
	}

	function runWarm () {
		const iterations = 5;

		// warm up
		let i = 50;
		while ( i-- ) {
			const component = new Component({
				target: document.body
			});

			if ( component.run ) {
				component.run();
			}

			if ( component.destroy ) {
				component.destroy();
			} else {
				component.teardown();
			}
		}

		// time warm runs
		i = iterations;

		let createTotal = 0;
		let runTotal = 0;
		let destroyTotal = 0;

		function go () {
			let component;

			return Promise.resolve()
				.then( () => {
					const t = now();
					component = new Component({
						target: document.body
					});
					createTotal += now() - t;
				})
				.then( wait )
				.then( () => {
					if ( component.run ) {
						const t = now();
						component.run();
						runTotal += now() - t;
					}
				})
				.then( wait )
				.then( () => {
					const t = now();
					if ( component.destroy ) {
						component.destroy();
					} else {
						component.teardown();
					}
					destroyTotal += now() - t;
				})
				.then( () => {
					if ( --i > 0 ) return go();
				});
		}

		return go().then( () => {
			window.opener.postMessage({
				type: 'create:warm',
				value: createTotal / iterations
			}, '*' );

			window.opener.postMessage({
				type: 'run:warm',
				value: runTotal / iterations
			}, '*' );

			window.opener.postMessage({
				type: 'destroy:warm',
				value: destroyTotal / iterations
			}, '*' );
		});
	}

	runCold()
		.then( runWarm )
		.then( () => {
			window.opener.postMessage({
				type: 'done'
			}, '*' );
		});
}