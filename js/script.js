(_ => {
	'use strict';

	const fileInput = document.querySelector('input[type="file"]');
	const btnGenerate = document.querySelector('input[type="button"]');
	const errorsContainer = document.getElementById('errors');
	const rawDataContainer = document.getElementById('rawData');
	const labelsContainer = document.getElementById('labels');

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
					description = description.replace(/\bIj/g, 'IJ');

					/* Only keep the first barcode. The field seems to contain the
					 * 5-digit SKU as well, and lots of `ESC` control codes. */
					barcode = barcode.replace(/[\n\u001C\u001D]/g, ' ').trim().split(' ')[0];

					/* Some barcodes incorrectly have an extra digit in front. */
					barcode = barcode.replace(/^[01](\d{13})$/, '$1');

					const labelContainer = document.createElement('div');
					labelContainer.classList.add('label');

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

					if (barcode.length > 5) {
						const barcodeContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
						barcodeContainer.setAttribute('width', '100%');
						barcodeContainer.setAttribute('height', '100%');
						barcodeContainer.classList.add('barcode');
						labelContainer.append(barcodeContainer);

						try {
							JsBarcode(barcodeContainer, barcode, {
								format: 'EAN13',
								flat: true,
								displayValue: false,
								width: 1,
								height: 25,
							});

							barcodeContainer.removeAttribute('style');
						} catch (e) {
							addError(`JsBarcode: ${typeof e === 'string' ? e : JSON.stringify(e, null, ' ')} in record: ${JSON.stringify(recordObject, null, ' ')}`);
						}
					}

					const li = document.createElement('li');
					li.append(labelContainer);
					labelsContainer.firstChild.append(li);
				});


				/* Show the number of errors. */
				const numErrors = document.querySelectorAll('#errors li').length;
				if (numErrors) {
					document.querySelector('#errors summary').textContent += ` (${numErrors})`;
				}
			}
		});

	};
})();
