// current weather conditions display
import { distance as calcDistance, directionToNSEW } from './utils/calc.mjs';
import { json } from './utils/fetch.mjs';
import STATUS from './status.mjs';
import { locationCleanup } from './utils/string.mjs';
import { celsiusToFahrenheit, kphToMph } from './utils/units.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Nejnovější pozorování', false);

		// constants
		this.MaximumRegionalStations = 7;
		this.showOnProgress = false;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// calculate distance to each station
		const stationsByDistance = Object.keys(StationInfo).map((key) => {
			const station = StationInfo[key];
			const distance = calcDistance(station.lat, station.lon, weatherParameters.latitude, weatherParameters.longitude);
			return { ...station, distance };
		});

		// sort the stations by distance
		const sortedStations = stationsByDistance.sort((a, b) => a.distance - b.distance);
		// try up to 30 regional stations
		const regionalStations = sortedStations.slice(0, 30);

		// get data for regional stations
		// get first 7 stations
		const actualConditions = [];
		let lastStation = Math.min(regionalStations.length, 7);
		let firstStation = 0;
		while (actualConditions.length < 7 && (lastStation) <= regionalStations.length) {
			// eslint-disable-next-line no-await-in-loop
			const someStations = await getStations(regionalStations.slice(firstStation, lastStation));

			actualConditions.push(...someStations);
			// update counters
			firstStation += lastStation;
			lastStation = Math.min(regionalStations.length + 1, firstStation + 7 - actualConditions.length);
		}

		// cut down to the maximum of 7
		this.data = actualConditions.slice(0, this.MaximumRegionalStations);

		// test for at least one station
		if (this.data.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const conditions = this.data;

		// sort array by station name
		const sortedConditions = conditions.sort((a, b) => ((a.Name < b.Name) ? -1 : 1));

		this.elem.querySelector('.column-headers .temp.english').classList.add('show');
		this.elem.querySelector('.column-headers .temp.metric').classList.remove('show');

		const lines = sortedConditions.map((condition) => {
			const engDir = directionToNSEW(condition.windDirection.value);
			const directionTranslations = {
				'N': 'S', 'NNE': 'SSV', 'NE': 'SV', 'ENE': 'VSV', 'E': 'V', 'ESE': 'VJV', 'SE': 'JV', 'SSE': 'JJV',
				'S': 'J', 'SSW': 'JJZ', 'SW': 'JZ', 'WSW': 'ZJZ', 'W': 'Z', 'WNW': 'ZSZ', 'NW': 'SZ', 'NNW': 'SSZ'
			};
			const windDirection = directionTranslations[engDir] || engDir;

			const	Temperature = Math.round(celsiusToFahrenheit(condition.temperature.value));
			const WindSpeed = Math.round(kphToMph(condition.windSpeed.value));

			const fill = {
				location: locationCleanup(condition.city).substr(0, 14),
				temp: Temperature,
				weather: shortenCurrentConditions(condition.textDescription).substr(0, 9),
			};

			if (WindSpeed > 0) {
				fill.wind = windDirection + (Array(6 - windDirection.length - WindSpeed.toString().length).join(' ')) + WindSpeed.toString();
			} else if (WindSpeed === 'NA') {
				fill.wind = 'NA';
			} else {
				fill.wind = 'Klid';
			}

			return this.fillTemplate('observation-row', fill);
		});

		const linesContainer = this.elem.querySelector('.observation-lines');
		linesContainer.innerHTML = '';
		linesContainer.append(...lines);

		this.finishDraw();
	}
}
const shortenCurrentConditions = (_condition) => {
	const conditionTranslations = {
		'Clear': 'Jasno',
		'Mostly Clear': 'Skoro jas',
		'Partly Cloudy': 'Polojasno',
		'Mostly Cloudy': 'Větš. obl',
		'Cloudy': 'Zataženo',
		'Overcast': 'Zataženo',
		'Fog': 'Mlha',
		'Light Rain': 'Sl. déšť',
		'Rain': 'Déšť',
		'Heavy Rain': 'Sil. déšť',
		'Light Snow': 'Sl. sněž.',
		'Snow': 'Sněžení',
		'Heavy Snow': 'Sil. sněž',
		'Thunderstorm': 'Bouřka'
	};
	let condition = conditionTranslations[_condition] || _condition;
	condition = condition.replace(/Light/, 'Sl.');
	condition = condition.replace(/Heavy/, 'Sil.');
	condition = condition.replace(/Partly/, 'Polo');
	condition = condition.replace(/Mostly/, 'Větš.');
	condition = condition.replace(/Few/, 'Skoro');
	condition = condition.replace(/Thunderstorm/, 'Bouř.');
	condition = condition.replace(/ in /, '');
	condition = condition.replace(/Vicinity/, '');
	condition = condition.replace(/ and /, ' a ');
	condition = condition.replace(/Freezing Rain/, 'Mrz.déšť');
	condition = condition.replace(/Freezing/, 'Mrz.');
	condition = condition.replace(/Unknown Precip/, '');
	condition = condition.replace(/L Snow Fog/, 'Sl.Sněh/Mlh');
	condition = condition.replace(/ with /, '/');
	return condition;
};

const getStations = async (stations) => {
	const stationData = await Promise.all(stations.map(async (station) => {
		try {
			const data = await json(`https://api.weather.gov/stations/${station.id}/observations/latest`, { retryCount: 1, stillWaiting: () => this.stillWaiting() });
			// test for temperature, weather and wind values present
			if (data.properties.temperature.value === null
			|| data.properties.textDescription === ''
			|| data.properties.windSpeed.value === null) return false;
			// format the return values
			return {
				...data.properties,
				StationId: station.id,
				city: station.city,
			};
		} catch (error) {
			console.log(`Unable to get latest observations for ${station.id}`);
			return false;
		}
	}));
	// filter false (no data or other error)
	return stationData.filter((d) => d);
};
// register display
registerDisplay(new LatestObservations(2, 'latest-observations'));
