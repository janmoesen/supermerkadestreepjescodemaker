(_ => {
	'use strict';

	const fileInput = document.querySelector('input[type="file"]');
	const btnGenerate = document.querySelector('input[type="button"]');
	const errorsContainer = document.getElementById('errors');
	const rawDataContainer = document.getElementById('rawData');
	const labelsContainer = document.getElementById('labels');

	const barcodeLengthsToTypes = {
		8: 'EAN8',
		13: 'EAN13',
	};

	function addError(error) {
		const li = document.createElement('li');
		const pre = li.appendChild(document.createElement('pre'));

		pre.textContent = typeof error === 'string'
			? error.trim()
			: JSON.stringify(error, null, '  ');

		if (!errorsContainer.firstChild) {
			errorsContainer.innerHTML = '<details><summary>Foutmeldingen</summary><ol></ol></details>';
		}

		errorsContainer.querySelector('ol').append(li);
	}

	/* Handle file input. */
	fileInput.oninput = event => {
		btnGenerate.disabled = true;

		if (fileInput.files[0]) {
			btnGenerate.disabled = false;

			/* Automatically click after selecting a file. */
			btnGenerate.click();
		}
	};

	/* Handle filter requests. */
	const filterNamesToInputs = {
		description: document.querySelector('.filterInput[name="description"]'),
		hasBarcodeYes: document.querySelector('.filterInput[name="hasBarcode"][value="yes"]'),
		hasBarcodeNo: document.querySelector('.filterInput[name="hasBarcode"][value="no"]'),
		hasBarcodeWhatever: document.querySelector('.filterInput[name="hasBarcode"][value=""]'),
	};

	const filterStyleSheet = document.getElementById('filterCss');

	function escapeCssAttributeSelectorValue(str) {
		return str.replaceAll('"', '\\"');
	}

	function applyFilters() {
		let filterCss = '';

		Object.entries(filterNamesToInputs).forEach(([filterName, filterInput]) => {
			if (filterInput.value.trim() === '') {
				return;
			}

			if (filterInput.type === 'text') {
				const words = filterInput.value.trim().toLowerCase().split(/\s+/g);

				const attributeSelectors = words.map(word => {
					/* Anchor search terms to the beginning of words in the text,
					 * unless the search term starts with an asterisk, a.k.a. the
					 * international wildcard symbol. */
					let charBeforeWord = ' ';
					if (word.startsWith('*')) {
						charBeforeWord = '';
						word = word.replace(/^\*+/, '');
					}

					return `[data-${filterName}*="${charBeforeWord}${escapeCssAttributeSelectorValue(word.toLowerCase())}"]`;
				});

				filterCss += `
					#labels li:not(${attributeSelectors.join('')}) {
						display: none;
					}
				`;

				return;
			} else if (filterInput.type === 'radio') {
				if (!filterInput.checked) {
					return;
				}

				if (filterInput.name === 'hasBarcode') {
					filterCss += `
						#labels li:not([data-has-barcode="${escapeCssAttributeSelectorValue(filterInput.value)}"]) {
							display: none;
						}
					`;

					return;
				}
			}
		});

		filterStyleSheet.textContent = filterCss;
	}

	let filterTimeoutId;
	Object.entries(filterNamesToInputs).forEach(([filterName, filterInput]) => {
		filterInput.oninput = _ => {
			clearTimeout(filterTimeoutId);

			filterTimeoutId = setTimeout(applyFilters, 100);
		};
	});

	/* Open the filter form by default if any filters are active. */
	Object.entries(filterNamesToInputs).forEach(([filterName, filterInput]) => {
		if (filterInput.type ==='text' && filterInput.value.trim() !== '') {
			filterInput.closest('details').open = true;
			return;
		}

		if (filterInput.type === 'radio' && filterInput.value.trim() !== '' && filterInput.checked) {
			filterInput.closest('details').open = true;
		}
	});


	/* Handle button clicks. */
	btnGenerate.onclick = event => {
		event.preventDefault();

		/* Parse the CSV. */
		Papa.parse(fileInput.files[0], {
			skipEmptyLines: 'greedy',
			complete: function(results) {
				/* Show the errors, if any. */
				errorsContainer.textContent = '';
				results.errors.forEach(error => addError(error));

				/* Show the raw data. */
				rawDataContainer.textContent = '';
				if (results.data.length) {
					const pre = document.createElement('pre');
					pre.textContent = JSON.stringify(results.data, null, '  ');
					rawDataContainer.innerHTML = '<details><summary>Onbewerkte gegevens</summary></details>';
					rawDataContainer.firstChild.append(pre);
				}

				/* Turn the raw data into printable labels. */
				labelsContainer.innerHTML = '<ul></ul>';
				results.data.forEach(record => {
					let [description, barcode, sku, socialPrice, regularPrice] = record;

					/* Make sure all the expected columns are defined. */
					const recordObject = {description, barcode, sku, socialPrice, regularPrice};
					for (let [key, value] of Object.entries(recordObject)) {
						if (typeof value === 'undefined') {
							addError(`Missing ${key} in record: ${JSON.stringify(recordObject, null, ' ')}`);
							return;
						}
					}

					/* Do a price check on aisle 4. */
					for (let [key, value] of Object.entries({socialPrice, regularPrice})) {
						if (value === '' || value === ',' || value === '0') {
							addError(`Missing ${key} in record: ${JSON.stringify(recordObject, null, ' ')}`);
							return;
						}
					}

					/* Make sure there is at least 1 digit before the decimal comma.
					 * `0,90` gets exported as `,9`. */
					if (socialPrice.match(/^,/)) {
						socialPrice = `0${socialPrice}`;
					}

					if (regularPrice.match(/^,/)) {
						regularPrice = `0${regularPrice}`;
					}

					/* Re-add the `,00` for integer prices. */
					if (!socialPrice.match(/,/)) {
						socialPrice = `${socialPrice},00`;
					}

					if (!regularPrice.match(/,/)) {
						regularPrice = `${regularPrice},00`;
					}

					/* Make sure there are two digits after the decimal comma. */
					if (!socialPrice.match(/,\d\d$/)) {
						socialPrice = `${socialPrice}00`.replace(/(,..).*/, '$1');
					}

					if (!regularPrice.match(/,\d\d$/)) {
						regularPrice = `${regularPrice}00`.replace(/(,..).*/, '$1');
					}

					/* Fix a pet peeve of mine: `Ij` → `IJ` / `Ĳ`. */
					description = description.trim().replace(/\bIj/g, 'IJ');

					/* Only keep the last (most recent) supported barcode. The
					 * field seems to contain the 5-digit SKU as well, and lots
					 * of (mostly `ESC`) control codes. */
					barcode = barcode.replace(/[\n\u001C\u001D]+/g, ' ').trim()
						.split(' ')
						.filter(barcode => barcodeLengthsToTypes[barcode.length])
						.pop() ?? '';

					/* Create the DOM structure for the label. */
					const li = document.createElement('li');
					li.dataset.description = ` ${description.toLowerCase()}  ${barcode.toLowerCase()} ${sku.toLowerCase()} `;
					li.dataset.hasBarcode = 'no';

					const labelContainer = document.createElement('div');
					labelContainer.classList.add('label');
					li.append(labelContainer);

					const descriptionContainer = document.createElement('div');
					descriptionContainer.classList.add('description');
					descriptionContainer.textContent = description;
					labelContainer.append(descriptionContainer);

					const regularPriceContainer = document.createElement('div');
					regularPriceContainer.classList.add('regularPrice');
					regularPriceContainer.textContent = `€ ${regularPrice}`;
					labelContainer.append(regularPriceContainer);

					const socialPriceContainer = document.createElement('div');
					socialPriceContainer.classList.add('socialPrice');
					socialPriceContainer.textContent = `€ ${socialPrice}`;
					labelContainer.append(socialPriceContainer);

					const socialTextContainer = document.createElement('div');
					socialTextContainer.classList.add('socialText');
					socialTextContainer.textContent = 'sociaal';
					labelContainer.append(socialTextContainer);

					const skuContainer = document.createElement('div');
					skuContainer.classList.add('sku');
					skuContainer.textContent = sku;
					labelContainer.append(skuContainer);

					if (barcodeLengthsToTypes[barcode.length]) {
						const barcodeContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
						barcodeContainer.classList.add('barcode');
						barcodeContainer.setAttribute('width', '100%');
						barcodeContainer.setAttribute('height', '100%');
						labelContainer.append(barcodeContainer);
						labelContainer.setAttribute('title', barcode);

						try {
							JsBarcode(barcodeContainer, barcode, {
								format: barcodeLengthsToTypes[barcode.length],
								flat: true,
								displayValue: false,
								width: 1,
								height: 25,
							});

							barcodeContainer.removeAttribute('style');

							li.dataset.hasBarcode = 'yes';

						} catch (e) {
							addError(`JsBarcode: ${typeof e === 'string' ? e : JSON.stringify(e, null, ' ')} in record: ${JSON.stringify(recordObject, null, ' ')}`);
						}
					}

					labelsContainer.firstChild.append(li);
				});


				/* Show the number of errors. */
				const numErrors = document.querySelectorAll('#errors li').length;
				if (numErrors) {
					document.querySelector('#errors summary').textContent += ` (${numErrors})`;
				}

				/* Apply any filters that were already set before parsing. */
				applyFilters();
			}
		});
	};
})();
