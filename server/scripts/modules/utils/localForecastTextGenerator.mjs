import { directionToNSEW } from './calc.mjs';

import ConversionHelpers from './conversionHelpers.mjs';

function generateLocalForecast(dateStamp, hourlyData) {
	const MORNING_HOURS = [...Array(12).keys()].map((h) => h + 6); // 6 AM - 6 PM
	const NIGHT_HOURS = [...Array(6).keys()].map((h) => h + 18).concat([...Array(6).keys()]); // 6 PM - 6 AM

	const phraseVariations = {
		'CHANCE OF PRECIPITATION': ['PRAVDĚPODOBNOST SRÁŽEK', 'OČEKÁVANÁ PRAVDĚPODOBNOST SRÁŽEK', 'ŠANCE NA PŘEHÁŇKY', 'MOŽNOST SRÁŽEK', 'PRAVDĚPODOBNOST DEŠTĚ', 'OČEKÁVAJÍ SE PŘEHÁŇKY', 'SRÁŽKY JSOU PRAVDĚPODOBNÉ'],
		WIND: ['VÍTR OD', 'OČEKÁVEJTE VÍTR OD', 'VÍTR POVANE OD', 'MÍRNÝ VÍTR OD', 'NÁRAZY VĚTRU OD', 'VÍTR SE OČEKÁVÁ OD'],
		CLOUDY: ['OBLAČNO', 'OBLOHA BUDE VĚTŠINOU ZATAŽENÁ', 'OČEKÁVÁ SE ZATAŽENO', 'POLOJASNO', 'VĚTŠINOU OBLAČNO S INTERVALY SLUNCE', 'OBLAKA OVLÁDNOU OBLOHU'],
		CLEAR: ['VĚTŠINOU JASNÁ OBLOHA', 'OČEKÁVÁ SE MÁLO OBLAČNOSTI', 'OBLOHA ZŮSTANE JASNÁ', 'JASNO A SLUNEČNO', 'OČEKÁVÁ SE JASNÁ OBLOHA', 'VELMI MÁLO OBLAČNOSTI'],
		'SNOW SHOWERS': ['PRAVDĚPODOBNÉ SNĚHOVÉ PŘEHÁŇKY', 'OČEKÁVÁ SE SNĚŽENÍ', 'MOŽNOST SLABÉHO SNĚŽENÍ'],
	};

	const forecastTemplates = [
		'{period}...  {cloudCover}, S {tempLabel} KOLEM {temp}. {windInfo}. {precipChance}',
		'{period}... {cloudCover}, {tempLabel} BLÍZKO {temp}. {windInfo}. {precipChance}',
		'{period}... {cloudCover}, {tempLabel} KOLEM {temp}. {windInfo}. {precipChance}',
		'{cloudCover} PRO TOTO {period}, {tempLabel} KOLEM {temp}. {windInfo}. {precipChance}',
		'{period} PŘEDPOVĚĎ: {cloudCover}, {tempLabel} {temp}. {windInfo}. {precipChance}',
		'{period} VÝHLED: {cloudCover}, OČEKÁVEJTE {tempLabel} KOLEM {temp}. {windInfo}. {precipChance}',
		'{period} POČASÍ: {cloudCover}, {tempLabel} NA {temp}. {windInfo}. {precipChance}',
		'{period}... {cloudCover}, {tempLabel} BLÍZKO {temp}. {windInfo}. {precipChance}',
		'{period}... {tempLabel} KOLEM {temp}. {cloudCover}. {windInfo}. {precipChance}',
		'{period}... {cloudCover}. {windInfo}. {precipChance} {tempLabel} KOLEM {temp}.',
		'{period} PŘEDPOVĚĎ: {cloudCover}, S TEPLOTAMI KOLEM {temp}. {windInfo}. {precipChance}',
		'{period} VÝHLED POČASÍ: {cloudCover}. {windInfo}. {precipChance} OČEKÁVEJTE TEPLOTY KOLEM {temp}.',
	];

	function getMostFrequent(arr) {
		return arr.sort((a, b) => arr.filter((v) => v === a).length - arr.filter((v) => v === b).length).pop();
	}

	// eslint-disable-next-line no-shadow
	function processForecast(hourlyData, period) {
		const periodData = hourlyData.filter((entry) => (period === 'MORNING' ? MORNING_HOURS : NIGHT_HOURS).includes(new Date(entry.time).getHours()));

		if (!periodData.length) return null;

		const temps = periodData.map((entry) => ConversionHelpers.convertTemperatureUnits(Math.round(entry.temperature_2m)));
		const temp = period === 'MORNING' ? Math.max(...temps) : Math.min(...temps);
		const tempLabel = period === 'MORNING' ? 'MAX' : 'MIN';
		const periodLabel = period === 'MORNING' ? 'RÁNO' : 'NOC';

		const directionTranslations = {
			'N': 'S', 'NNE': 'SSV', 'NE': 'SV', 'ENE': 'VSV', 'E': 'V', 'ESE': 'VJV', 'SE': 'JV', 'SSE': 'JJV',
			'S': 'J', 'SSW': 'JJZ', 'SW': 'JZ', 'WSW': 'ZJZ', 'W': 'Z', 'WNW': 'ZSZ', 'NW': 'SZ', 'NNW': 'SSZ'
		};

		const windSpeeds = periodData.map((entry) => ConversionHelpers.convertWindUnits(Math.round(entry.wind_speed_10m)));
		const windDirs = periodData.map((entry) => entry.wind_direction_10m);
		const engDir = directionToNSEW(getMostFrequent(windDirs));
		const windDir = directionTranslations[engDir] || engDir;
		const windInfo = `VÍTR ${windDir} ${Math.min(...windSpeeds)} AŽ ${Math.max(...windSpeeds)} ${ConversionHelpers.getWindUnitText().toUpperCase()}`;

		const precipProbs = periodData.map((entry) => entry.precipitation_probability);
		const maxPrecip = Math.max(...precipProbs);
		let precipChance = 'SRÁŽKY SE NEOČEKÁVAJÍ.';

		if (maxPrecip >= 30) {
			const peakHour = periodData.find((entry) => entry.precipitation_probability === maxPrecip)?.time;
			const hour = new Date(peakHour).getHours();
			const precipTime = `PO ${hour}. HODINĚ`;
			precipChance = `${phraseVariations['CHANCE OF PRECIPITATION'][Math.floor(Math.random() * phraseVariations['CHANCE OF PRECIPITATION'].length)]} ${precipTime}. ŠANCE JE ${maxPrecip}%.`;
		}

		const cloudCover = periodData.map((entry) => entry.cloud_cover);
		const averagedCloudCover = Math.max(...cloudCover);
		let cloudCoverText = '';

		if (averagedCloudCover >= 0 && averagedCloudCover < 20) {
			cloudCoverText = phraseVariations.CLEAR[Math.floor(Math.random() * 3)];
		} else if (averagedCloudCover >= 20 && averagedCloudCover < 50) {
			cloudCoverText = phraseVariations.CLEAR[Math.floor(Math.random() * 3)];
		} else if (averagedCloudCover >= 50 && averagedCloudCover < 80) {
			cloudCoverText = phraseVariations.CLOUDY[Math.floor(Math.random() * 3)];
		} else {
			cloudCoverText = phraseVariations.CLOUDY[Math.floor(Math.random() * 3)];
		}

		const forecastText = forecastTemplates[Math.floor(Math.random() * forecastTemplates.length)]
			.replace('{period}', periodLabel)
			.replace('{cloudCover}', cloudCoverText)
			.replace('{tempLabel}', tempLabel)
			.replace('{temp}', temp)
			.replace('{windInfo}', windInfo)
			.replace('{precipChance}', precipChance)
			.replace(/\n/g, '')
			.replace(/\r/g, '');

		return {
			period,
			temperature: { label: tempLabel, value: temp },
			wind: windInfo,
			precipitation: precipChance,
			skyCondition: cloudCover,
			text: forecastText,
		};
	}

	// Generate forecast for the provided date
	const dayDate = new Date(dateStamp);
	const dayStr = dayDate.toLocaleDateString('cs-CZ', { weekday: 'long' }).toUpperCase();

	const dailyData = hourlyData.filter((entry) => new Date(entry.time).toDateString() === dayDate.toDateString());

	const morningForecast = processForecast(dailyData, 'MORNING');
	const nightForecast = processForecast(dailyData, 'NIGHT');

	const forecast = {
		date: dayStr,
		periods: {
			morning: morningForecast,
			night: nightForecast,
		},
	};

	return JSON.stringify(forecast, null, 2);
}

export {
	// eslint-disable-next-line import/prefer-default-export
	generateLocalForecast,
};
