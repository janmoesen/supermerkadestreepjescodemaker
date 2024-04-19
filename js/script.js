(_ => {
	'use strict';

	const fileInput = document.querySelector('input[type="file"]');
	const btnGenerate = document.querySelector('input[type="button"]');

	const textFilterInput = document.querySelector('#filterForm [name="description"]');
	const barcodeLengthFilterInput = document.querySelector('#filterForm [name="barcodeLength"]');
	const sortInput = document.querySelector('#filterForm [name="sortBy"]');

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

	/* Disable the default form submission (e.g. by pressing Enter). */
	fileInput.form.onsubmit = event => event.preventDefault();

	/* Handle file input. */
	fileInput.oninput = event => {
		btnGenerate.disabled = true;

		if (fileInput.files[0]) {
			btnGenerate.disabled = false;

			/* Automatically click after selecting a file. */
			btnGenerate.click();
		}
	};

	/* Filtering and sorting. */
	const filterStyleSheet = document.getElementById('filterCss');

	function escapeCssAttributeSelectorValue(str) {
		return str.replaceAll('"', '\\"');
	}

	/* Ignore accents and some other common (in Belgium) non-ASCII things when
	 * filtering. */
	 const unicodeToAsciiReplacements = {
		 'æ': 'ae',
		 'œ': 'oe',
		 'ø': 'o',
		 '‘': "'",
		 '’': "'",
		 '“': '"',
		 '”': '"',
	 };

	const unicodeToAsciiReplacementsRegExp = new RegExp(Object.keys(unicodeToAsciiReplacements).join('|'), 'g');

	/**
	 * Normalize a string for filtering. There is no built-in iconv-like
	 * transliteration yet, so use Unicode Canonical Decomposition, get rid of
	 * the diacritics, and then replace some other things like digraphs.
	 */
	function normalizeForFiltering(str) {
		let normalizedString = str.trim().toLowerCase().normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '');
		normalizedString = normalizedString.replaceAll(unicodeToAsciiReplacementsRegExp, unicode => unicodeToAsciiReplacements[unicode]);

		return normalizedString;
	}

	/**
	 * Apply the filters specified by the user in the UI.
	 */
	function applyFilters() {
		let filterCss = '';

		/* Text filter (description, barcode, sku). */
		if (textFilterInput.value.trim() !== '') {
			const words = normalizeForFiltering(textFilterInput.value).split(/\s+/g);

			const attributeSelectors = words.map(word => {
				/* Anchor search terms to the beginning of words in the text,
				 * unless the search term starts with an asterisk, a.k.a. the
				 * international wildcard symbol. */
				let charBeforeWord = ' ';
				if (word.startsWith('*')) {
					charBeforeWord = '';
					word = word.replace(/^\*+/, '');
				}

				return `[data-description*="${charBeforeWord}${escapeCssAttributeSelectorValue(word.toLowerCase())}"]`;
			});

			filterCss += `
				#labels li:not(${attributeSelectors.join('')}) {
					display: none;
				}
			`;
		}

		/* Barcode length filter. */
		if (barcodeLengthFilterInput.value !== '') {
			if (barcodeLengthFilterInput.value === '>0') {
				filterCss += `
					#labels li:not([data-barcode-length]),
					#labels li[data-barcode-length="0"] {
						display: none;
					}
				`;
			} else {
				filterCss += `
					#labels li:not([data-barcode-length="${escapeCssAttributeSelectorValue(barcodeLengthFilterInput.value)}"]) {
						display: none;
					}
				`;
			}
		}

		filterStyleSheet.textContent = filterCss;

		/* Show the number of (filtered) labels. */
		const numLabelsPerPrintedPage = 21;
		const counterContainer = document.getElementById('counter');
		const numFilteredLabels = Array.from(document.querySelectorAll('#labels li'))
			.filter(label => label.offsetHeight > 0)
			.length;
		counterContainer.innerHTML = counterContainer.dataset.htmlTemplate
			.replace('%d', numFilteredLabels)
			.replace('%d', Math.ceil(numFilteredLabels / numLabelsPerPrintedPage));
	}

	/* Apply the filters when updating the inputs. */
	let filterTimeoutId;
	textFilterInput.oninput = _ => {
		clearTimeout(filterTimeoutId);

		filterTimeoutId = setTimeout(applyFilters, 100);
	};

	barcodeLengthFilterInput.oninput = applyFilters;

	/* Open the filter form by default if any filters are active. */
	if (textFilterInput.value.trim() !== '' || barcodeLengthFilterInput.value !== '') {
		textFilterInput.closest('details').open = true;
	}


	/**
	 * Sort the labels as specified by the user in the UI.
	 */
	function applySorting() {
		const [sortKey, sortDirection] = sortInput.value.split(';');
		if (!sortKey) {
			return;
		}

		const isSortKeyPrice = sortKey === 'regularPrice' || sortKey === 'socialPrice';

		const isSortedAscending = sortDirection === 'asc';

		let allLabels = Array.from(labelsContainer.querySelectorAll('li'));
		if (!allLabels.length) {
			return;
		}

		allLabels = allLabels.sort((a, b) => {
			const valueA = isSortKeyPrice
				? parseFloat(a.dataset[sortKey].replace(',', '.'))
				: a.dataset[sortKey].trim();
			const valueB = isSortKeyPrice
				? parseFloat(b.dataset[sortKey].replace(',', '.'))
				: b.dataset[sortKey].trim();

			let comparisonValue = valueA < valueB
				? -1
				: (valueA === valueB ? 0 : 1);

			if (!isSortedAscending) {
				comparisonValue *= -1;
			}

			return comparisonValue;
		});

		// NOTE: calling `allLabels[0].parentNode.append(allLabels)` does not
		// re-add the labels in the new order. Would have been simpler.
		allLabels.forEach(label => allLabels[0].parentNode.appendChild(label));
	}

	/* Sort the labels when updating the inputs. */
	sortInput.oninput = applySorting;


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
					li.dataset.description = ` ${normalizeForFiltering(description.toLowerCase())}  ${barcode.toLowerCase()} ${sku.toLowerCase()} `;
					li.dataset.barcodeLength = barcode.length;
					li.dataset.barcode = barcode;
					li.dataset.sku = sku;
					li.dataset.regularPrice = regularPrice;
					li.dataset.socialPrice = socialPrice;

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

				/* Apply any sorting that was already set before parsing. */
				applySorting();
			}
		});
	};

	/* Alternate between tips, if there are multiple tips. */
	document.querySelectorAll('.tip').forEach(tip => {
		const allTips = [{sortKey: Math.random(), html: tip.innerHTML}];
		let alternativeTipElement = tip.nextElementSibling;
		while (alternativeTipElement?.tagName === 'TEMPLATE') {
			allTips.push({
				sortKey: Math.random(),
				html: alternativeTipElement.content.firstElementChild?.innerHTML
			});
			alternativeTipElement = alternativeTipElement.nextElementSibling;
		}

		const randomTipHtml = allTips.sort((a, b) => a.sortKey - b.sortKey)[0].html;
		tip.innerHTML = randomTipHtml;
	});
})();
