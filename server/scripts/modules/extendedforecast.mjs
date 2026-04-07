// display extended forecast graphically
// technically uses the same data as the local forecast, we'll let the browser do the caching of that

import STATUS from './status.mjs';
import { getWeatherIconFromIconLink } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';

import ConversionHelpers from './utils/conversionHelpers.mjs';

class ExtendedForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Rozšířená předpověď', true);

		// set timings
		this.timing.totalScreens = 2;
	}

	static dayConditionTextSanitizer(text) {
		let sanitizedText;
		const spaces = text.split(' ');

		if (spaces.length > 2) {
			// text is too long, first word is
			// likely "Slight" so we'll cut it.
			sanitizedText = spaces.slice(0, 2).join(' ');

			return sanitizedText;
		}

		// Special case for thunderstorm(s), as
		// it clips into the other day panels
		if (text.toLowerCase() === 'thunderstorm' || text.toLowerCase() === 'bouřka') {
			// special case for thunderstorms
			sanitizedText = 'Bouřka';
			return sanitizedText;
		}

		return text;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;

		this.data = parse(_weatherParameters);
		this.screenIndex = 0;
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// determine bounds
		// grab the first three or second set of three array elements
		const forecast = this.data.slice(0 + 3 * this.screenIndex, 3 + this.screenIndex * 3);

		// create each day template
		const days = forecast.map((Day) => {
			const fill = {
				icon: { type: 'img', src: Day.icon },
				condition: ExtendedForecast.dayConditionTextSanitizer(Day.text),
				date: Day.dayName,
			};

			const { low } = Day;
			if (low !== undefined) {
				fill['value-lo'] = Math.round(low);
			}
			const { high } = Day;
			fill['value-hi'] = Math.round(high);

			// return the filled template
			return this.fillTemplate('day', fill);
		});

		// empty and update the container
		const dayContainer = this.elem.querySelector('.day-container');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);
		this.finishDraw();
	}
}

const conditionTranslations = {
	'Clear sky': 'Jasno',
	'Mainly clear': 'Většinou jasno',
	'Partly cloudy': 'Polojasno',
	'Overcast': 'Zataženo',
	'Fog': 'Mlha',
	'Depositing rime fog': 'Mrznoucí mlha',
	'Light Drizzle': 'Slabé mrholení',
	'Moderate Drizzle': 'Mírné mrholení',
	'Dense Drizzle': 'Husté mrholení',
	'Light Freezing Drizzle': 'Sl. mrz. mrh.',
	'Dense Freezing Drizzle': 'Sil. mrz. mrh.',
	'Slight Rain': 'Slabý déšť',
	'Moderate Rain': 'Mírný déšť',
	'Heavy Rain': 'Silný déšť',
	'Light Freezing Rain': 'Slabý mrz. déšť',
	'Heavy Freezing Rain': 'Silný mrz. déšť',
	'Slight Snow fall': 'Slabé sněžení',
	'Moderate Snow fall': 'Mírné sněžení',
	'Heavy Snow fall': 'Silné sněžení',
	'Snow grains': 'Sněhová zrna',
	'Slight Rain showers': 'Slabé přeháňky',
	'Moderate Rain showers': 'Mírné přeháňky',
	'Violent Rain showers': 'Silné přeháňky',
	'Slight Snow showers': 'Sl. sněh. přeh.',
	'Heavy Snow Showers': 'Sil sněh. přeh.',
	'Thunderstorm': 'Bouřka',
	'Thunderstorm with slight hail': 'Bouřka, sl. kr.',
	'Thunderstorm with heavy hail': 'Bouřka, sil. kr.'
};

// the api provides the forecast in 12 hour increments, flatten to day increments with high and low temperatures
const parse = (fullForecast) => {
	const forecast = [];

	Object.values(fullForecast.forecast).forEach((period) => {
		const engText = getConditionText(parseInt(period.weather_code, 10));
		const text = conditionTranslations[engText] || engText;
		const date = new Date(period.hours[11].time);

		const fDay = {
			text,
			icon: getWeatherIconFromIconLink(engText, fullForecast.timeZone, true),
			date,
			dayName: date.toLocaleDateString('cs-CZ', { weekday: 'long' }),
			high: ConversionHelpers.convertTemperatureUnits(period.temperature_2m_max),
			low: ConversionHelpers.convertTemperatureUnits(period.temperature_2m_min),
		};

		forecast.push(fDay);
	});

	return forecast;
};

// register display
registerDisplay(new ExtendedForecast(8, 'extended-forecast'));
