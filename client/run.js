export function createAndDestroy () {
	if ( window.error ) {
		window.opener.postMessage({
			type: 'error',
			message: window.error
		}, '*' );

		window.opener.postMessage({
			type: 'done'
		}, '*' );
	} else {
		const now = () => window.performance.now();

		/* COLD */

		// component create
		let t = now();
		let component = new Component({
			target: document.body
		});
		let duration = now() - t;

		window.opener.postMessage({
			type: 'create:cold',
			value: duration
		}, '*' );

		// component destroy
		t = now();
		if ( component.destroy ) {
			component.destroy();
		} else {
			component.teardown();
		}
		duration = now() - t;

		window.opener.postMessage({
			type: 'destroy:cold',
			value: duration
		}, '*' );

		/* WARM */

		const iterations = 100;

		// warm up
		let i = 100;
		while ( i-- ) {
			component = new Component({
				target: document.body
			});

			if ( component.destroy ) {
				component.destroy();
			} else {
				component.teardown();
			}
		}

		// time warm runs
		i = iterations;

		let createTotal = 0;
		let destroyTotal = 0;

		while ( i-- ) {
			t = now();
			component = new Component({
				target: document.body
			});
			createTotal += now() - t;

			t = now();
			if ( component.destroy ) {
				component.destroy();
			} else {
				component.teardown();
			}
			destroyTotal += now() - t;
		}

		window.opener.postMessage({
			type: 'create:warm',
			value: createTotal / iterations
		}, '*' );

		window.opener.postMessage({
			type: 'destroy:warm',
			value: destroyTotal / iterations
		}, '*' );

		window.opener.postMessage({
			type: 'done'
		}, '*' );
	}
}