(_ => {
	'use strict';

	const fileInput = document.querySelector('input[type="file"]');
	const btnGenerate = document.querySelector('input[type="button"]');
	const errorsContainer = document.getElementById('errors');
	const rawDataContainer = document.getElementById('rawData');
	const barcodesContainer = document.getElementById('barcodes');

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
					rawDataContainer.innerHTML = '<details><summary>Data</summary></details>';
					rawDataContainer.firstChild.append(pre);
				}

				/* Process the raw data. */
				barcodesContainer.textContent = '';
				results.data.forEach(record => {
					// JSBarcode it
					//const svg = document.createElement('svg');
				});
			}
		});

	};
})();
