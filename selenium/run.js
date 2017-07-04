const fs = require('fs');
const {Builder, By, until} = require('selenium-webdriver');
const chalk = require('chalk');
const minimist = require('minimist');
const {build} = require('../scripts/build-tools');

const command = minimist(process.argv.slice(2));

const capabilities = command.capabilities ? JSON.parse(command.capabilities) : [];
const server = command.server || null;
const browsers = command.browsers ? command.browsers.split(',') : [];
const iterations = command.iterations ? +command.iterations : 5;
const output = command.output || null;

const allVersions = require('../versions.json').map(version => {
	const split = version.split('.');
	return {
		major: +split[0],
		minor: +split[1],
		patch: +split[2]
	};
});
const benchmarks = fs.readdirSync('benchmarks').filter(d => d[0] !== '.');
const measurements = require('./measurements');

const versions = [];
allVersions.forEach(version => {
	if (versions.length < 5) {
		versions.push(`${version.major}.${version.minor}.${version.patch}`);
	} else if (versions.length < 10 && allVersions.filter(other => other.major === version.major && other.minor === version.minor && other.patch > version.patch).length === 0) {
		versions.push(`${version.major}.${version.minor}.${version.patch}`);
	}
});
console.log('Running versions', versions.join(', '));

const combinations = [];

if (command.custom) {
	build('custom', command.custom, true).then(run);
	versions.unshift('custom');
} else {
	run();
}

if (output && fs.existsSync(output)) {
	fs.unlinkSync(output);
}

function createDriver(results, browser, cap) {
	let driverInstance;

	let builder = new Builder();
	if (server) {
		builder = builder.usingServer(server);
	}
	if (browser) {
		builder = builder.forBrowser(browser);
	}
	if (cap) {
		builder = builder.withCapabilities(cap);
	}

	const capString = browser || `${cap.browserName} ${cap.version} (${cap.platform})`;

	driverInstance = builder.build();
	driverInstance.manage().timeouts().setScriptTimeout(5 * 1000);
	return sequence(combinations, ({version, benchmark, code, size}) => {
		console.log('Testing', version, benchmark, 'in', capString);

		results[benchmark][version] = {};

		results[benchmark][version].size = size;

		const base64 = Buffer.from(`<body>
                        <script>
                        ${code}
                        </${'script'}>
                        </body>`, 'utf8').toString('base64');

		return new Promise((resolve, reject) => {
			let messages = [];
			let times = iterations;

			function run() {
				return driverInstance.get(`data:text/html;base64,${base64}`)
					.then(() => driverInstance.executeAsyncScript(runCode).catch(err => {
						if (~err.message.indexOf('Timed out')) {
							return JSON.stringify({
								error: 'Timed out'
							});
						}
						throw err;
					}))
					.then(res => JSON.parse(res))
					.then(res => {
						if (Array.isArray(res)) {
							messages = messages.concat(res);
						} else {
							messages.push(res);
						}
						if (--times <= 0) {
							resolve(messages);
						} else {
							run();
						}
					}).catch(reject);
			}
			run();
		}).then(messages => {
			const errors = messages.filter(message => !!message.error);
			messages = messages.filter(message => !message.error);

			results[benchmark][version].error = errors.map(error => `"${error.error}"`).join(', ');
			results[benchmark][version].measurements = {};

			measurements.forEach(measurement => {
				results[benchmark][version].measurements[measurement.id] = analyse(messages, measurement);
			});
		});
	}).then(() => driverInstance.quit()).then(() => {
		benchmarks.forEach(benchmark => {
			output && fs.appendFileSync(output, '\n' + `${benchmark} (${capString})` + '\n');
			console.log('\n' + chalk.underline(`${benchmark} (${capString})`) + '\n');
			const versions = results[benchmark];

			const column = (text, width) => {
				text = ' ' + text;
				if (text.length > width) {
					return ' ..' + text.substr(text.length - width + 3, width);
				}
				while (text.length < width) {
					text = ' ' + text; // I would use the left pad module for this but..
				}
				return text;
			};

			const firstColumnWidth = 15;
			const dataColumnWidth = 15;

			let measurementsStr = '  ';
			measurementsStr += column('version', firstColumnWidth);
			measurements.forEach(measurement => measurementsStr += column(measurement.id, dataColumnWidth));
			output && fs.appendFileSync(output, measurementsStr + '\n');
			console.log(chalk.inverse(measurementsStr));

			Object.keys(versions).forEach(version => {
				const data = versions[version];
				if (data.error) {
					output && fs.appendFileSync(output, '  ' + column(version, firstColumnWidth) + ' ' + data.error + '\n');
					console.log('  ', column(version, firstColumnWidth), data.error);
				} else {
					let rowStr = `  ${column(version, firstColumnWidth)}`;
					measurements.forEach(measurement => {
						const measureData = data.measurements[measurement.id];
						const best = Object.keys(versions)
								.map(key => versions[key])
								.filter(other => !other.error)
								.filter(other => other.measurements[measurement.id].median < measureData.median).length === 0;
						let median = measureData.median.toFixed(3);
						let str = column(median, dataColumnWidth);

						if (best) {
							str = str.replace(median, chalk.black.bgGreen(median)); // `column` counts color codes in length
						}

						rowStr += str;
					});
					output && fs.appendFileSync(output, chalk.stripColor(rowStr) + '\n');
					console.log(rowStr);
				}
			});
			output && fs.appendFileSync(output, '\n');
			console.log('\n')
		});
	});
}

function run() {
	benchmarks.forEach(benchmark => {
		versions.forEach(version => {
			const data = require(`../public/benchmarks/${benchmark}/${version}/component.json`);
			combinations.push({
				version,
				benchmark,
				code: data.code,
				size: data.size
			})
		});
	});

	const results = {};
	benchmarks.forEach(benchmark => {
		results[benchmark] = {};
		versions.forEach(version => {
			results[benchmark][version] = {};
		});
	});

	let promise = Promise.resolve();

	browsers.forEach(browser => promise = promise.then(() => {
		console.log('Starting browser', browser);
		return createDriver(results, browser, null);
	}));

	capabilities.forEach(cap => promise = promise.then(() => {
		console.log('Running capability..');
		return createDriver(results, null, cap);
	}));

	if (browsers.length ^ capabilities.length === 0) {
		console.warn('No browsers or capabilities were will be ran.');
	}

	const time = Date.now();
	promise.then(() => console.log(`Took ${(Date.now() - time) / 1000}s.`)).catch(err => {
		console.error(err);
	});
}


function sequence(array, fn) {
	return array.reduce((promise, item) => {
		return promise.then(() => Promise.resolve(fn(item)));
	}, Promise.resolve());
}

function runCode() {
	const callback = arguments[arguments.length - 1];

	if (window.error) {
		return callback(JSON.stringify({
			error: window.error
		}));
	}

	const results = [];

	const now = () => window.performance.now();
	const wait = window.setImmediate ?
		() => new Promise(fulfil => setImmediate(fulfil)) :
		() => new Promise(fulfil => setTimeout(fulfil, 0));

	function runCold() {
		let component;

		return Promise.resolve()
			.then(() => {
				// component create
				const t = now();
				component = new Component({
					target: document.body
				});
				const duration = now() - t;

				results.push({
					type: 'create:cold',
					value: duration
				});
			})
			.then(wait)
			.then(() => {
				// component run
				let duration = 0;

				if (component.run) {
					const t = now();
					component.run();
					duration = now() - t;
				}

				results.push({
					type: 'run:cold',
					value: duration
				});
			})
			.then(wait)
			.then(() => {
				// component destroy
				const t = now();
				if (component.destroy) {
					component.destroy();
				} else {
					component.teardown();
				}
				const duration = now() - t;

				results.push({
					type: 'destroy:cold',
					value: duration
				});
			});
	}

	function runWarm() {
		// warm up
		let i = 25;
		while (i--) {
			const component = new Component({
				target: document.body
			});

			if (component.run) {
				component.run();
			}

			if (component.destroy) {
				component.destroy();
			} else {
				component.teardown();
			}
		}

		// time warm runs
		let component;

		return Promise.resolve()
			.then(() => {
				const t = now();
				component = new Component({
					target: document.body
				});
				results.push({
					type: 'create:warm',
					value: now() - t
				});
			})
			.then(wait)
			.then(() => {
				const t = now();
				if (component.run) {
					component.run();
				}

				results.push({
					type: 'run:warm',
					value: now() - t
				});
			})
			.then(wait)
			.then(() => {
				const t = now();
				if (component.destroy) {
					component.destroy();
				} else {
					component.teardown();
				}
				results.push({
					type: 'destroy:warm',
					value: now() - t
				});
			});
	}

	runCold()
		.then(runWarm)
		.then(() => {
			callback(JSON.stringify(results));
		})
		.catch(err => callback(JSON.stringify({
			error: err.message + '\n' + err.stack
		})));
}

function analyse(messages, measurement) {
	const filtered = messages
		.filter(message => message.type === measurement.id)
		.sort((a, b) => a.value - b.value);

	if (filtered.length === 0) {
		return {
			min: 0,
			max: 0,
			median: 0
		};
	}

	const mid = filtered.length >> 1;
	const median = filtered.length % 2 ? filtered[mid].value : (filtered[mid].value + filtered[mid - 1].value) / 2;

	return {
		min: filtered[0].value,
		max: filtered[filtered.length - 1].value,
		median
	};
}
