(_ => {
	'use strict';

	const fileInput = document.querySelector('input[type="file"]');
	const btnGenerate = document.querySelector('input[type="button"]');
	const errorsContainer = document.getElementById('errors');
	const rawDataContainer = document.getElementById('rawData');
	const labelsContainer = document.getElementById('labels');

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
			complete: function(results) {
				/* Show the errors, if any. */
				errorsContainer.textContent = '';
				if (results.errors.length) {
					const pre = document.createElement('pre');
					pre.textContent = JSON.stringify(results.errors, null, '  ');
					errorsContainer.innerHTML = '<details><summary>Foutmeldingen</summary></details>';
					errorsContainer.firstChild.append(pre);
				}

				/* Show the raw data. */
				rawDataContainer.textContent = '';
				if (results.data.length) {
					const pre = document.createElement('pre');
					pre.textContent = JSON.stringify(results.data, null, '  ');
					rawDataContainer.innerHTML = '<details><summary>Onbewerkte gegevens</summary></details>';
					rawDataContainer.firstChild.append(pre);
				}

				/* Turn the raw data into printable labels. */
				labelsContainer.textContent = '';
				results.data.forEach(record => {
					let [description, barcode, sku, socialPrice, regularPrice] = record;

					/* The last record is empty when the file (properly) ends with a
					 * newline, so skip that. */
					if (typeof barcode === 'undefined') {
						return;
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

					/* Only keep the first barcode. The field seems to contain the
					 * 5-digit SKU as well, and lots of `ESC` control codes. */
					barcode = barcode.split(/[\n\u001D]/)[0];

					const labelContainer = document.createElement('div');
					labelContainer.classList.add('label');
					const pre = document.createElement('pre');
					pre.textContent = JSON.stringify({description, barcode, sku, socialPrice, regularPrice}, null, ' ');
					labelContainer.append(pre);

					labelsContainer.append(labelContainer);

					// JSBarcode it
					//const svg = document.createElement('svg');
				});
			}
		});

	};
})();
