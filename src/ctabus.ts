import { chunkArray } from "./util.js";
const ctaBusTrackerKey = process.env.CTA_BUS_API_KEY;
const KEY_FORMAT_QUERY = `key=${ctaBusTrackerKey}&format=json`;
const BASE_URL = 'https://www.ctabustracker.com/bustime/api/v2';
const ROUTES_URL = `${BASE_URL}/getroutes?${KEY_FORMAT_QUERY}`;
const BASE_VEHICLES_URL = `${BASE_URL}/getvehicles?${KEY_FORMAT_QUERY}`;
const BASE_PREDICTIONS_URL = `${BASE_URL}/getpredictions?${KEY_FORMAT_QUERY}`;
const BASE_DIRECTIONS_URL = `${BASE_URL}/getdirections?${KEY_FORMAT_QUERY}`;
const BASE_PATTERNS_URL = `${BASE_URL}/getpatterns?${KEY_FORMAT_QUERY}`;
const BASE_STOPS_URL = `${BASE_URL}/getstops?${KEY_FORMAT_QUERY}`;

// TODO: Error handling on all fetches
// Vehicles fetch may return { msg: 'No data found for parameter'}

const routes = await fetchBusRoutes();
const routesLookup = {};
routes.forEach(route => {
    routesLookup[route.rt] = route;
});

// Cache objects to store fetched data with route ID as key.
let realTimeRouteData = {};
const evergreenRouteData = {};

let recentRoutes = [];

// Set-up refresh interval for real-time data
setInterval(async () => {
    recentRoutes = recentRoutes.filter(route => route.timestamp > Date.now() - 600000);
    const routesToRefresh = recentRoutes.map(route => route.rt);
    console.log(`Refreshing real-time route data for routes: ${routesToRefresh.join(',')}`);
    const freshData = await fetchBusRoutesData(routesToRefresh);
    const freshCache = {};
    freshData.forEach(route => {
        freshCache[route.id] = route;
    });
    realTimeRouteData = freshCache;

}, 60000);

export async function getBusRouteData(routeId: string) {
    // Validate routeId and throw error if it is not a valid CTA bus route
    if (routes.filter(route => route.rt === routeId).length !== 1) {
        throw new Error(`Invalid route identifier: ${routeId}`);
    }

    // If route data is already cached, just return the cached data.
    if (realTimeRouteData[routeId]) {
        console.log(`Returning cached real-time data for route ${routeId}`);
        recentRoutes.filter(route => route.rt === routeId)[0].timestamp = Date.now();
        return {
            ...realTimeRouteData[routeId],
            ...await getEvergreenRouteData(routeId),
        }
    }

    // Add requested route ID to recent routes
    // Shouldn't need to check if it's already there.
    // We know at this point that the requested route isn't cached, so it shouldn't be in recent routes either.
    recentRoutes.push({rt: routeId, timestamp: Date.now()});

    // Fetch bus route data for the single requested route.
    const [realTimeData, evergreenData] = await Promise.all([
        fetchBusRoutesData([routeId]),
        getEvergreenRouteData(routeId)
    ]);

    return {
        ...realTimeData[0],
        ...evergreenData
    };
}

async function fetchBusRoutes() {
    console.log('Initializing bus route data.');
    return fetch(ROUTES_URL)
        .then(res => res.json())
        .then(json => json['bustime-response']['routes']);
}

async function fetchBusRoutesData(routeIds: string[]) {
    if (!routeIds.length) {
        console.log('No route IDs to fetch data for.');
        return [];
    }
    const requestBatches = chunkArray(routeIds, 10);
    const batchResponses =  await Promise.all(requestBatches.map(batch => fetchBusRouteBatchData(batch)));

    // Flatten the batch responses into a single unified array
    return batchResponses.reduce((collector, batchResponse) => collector.concat(batchResponse), []);
}

async function fetchBusRouteBatchData(routeIds: string[]) {
    console.log(`Fetching real-time bus data for routes: ${routeIds.join(',')}`);
    if (routeIds.length > 10) {
        throw new Error(`Requested route vehicle data for ${routeIds.length} routes. Max is 10 routes per request.`);
    }

    const vehicles =  await fetchVehiclesData(routeIds);
    const predictions = await fetchPredictionsData(vehicles.map(vehicle => vehicle.vid));

    return routeIds.map(routeId => ({
        id: routesLookup[routeId].rt,
        rtnm: routesLookup[routeId].rtnm,
        vehicles: vehicles.filter(vehicle => vehicle.rt === routeId).map(vehicle => ({
            ...vehicle,
            predictions: predictions.filter(prediction => prediction.vid === vehicle.vid),
        })),
    }));
}

function fetchVehiclesData(routeIds: string[]) {
    return fetch(`${BASE_VEHICLES_URL}&rt=${routeIds.join(',')}`)
        .then(res => res.json())
        .then(json => json['bustime-response']['vehicle']);
}

async function fetchPredictionsData(vehicleIds: string[]) {
    if (!vehicleIds.length) {
        console.log('No vechicle IDs to fetch predictions data for.');
        return [];
    }
    const requestBatches: string[][] = chunkArray(vehicleIds, 10);
    const batchResponses = await Promise.all(requestBatches.map(batch => fetchPredictionsBatchData(batch)));

    // Flatten the batch responses into a single unified array
    return batchResponses.reduce((collector, batchResponse) => collector.concat(batchResponse), []);
}

function fetchPredictionsBatchData(vehicleIds: string[]) {
    console.log(`Fetching real-time predictions data for vehicles: ${vehicleIds.join(',')}`);
    if (vehicleIds.length > 10) {
        throw new Error(`Requested predictions data for ${vehicleIds.length} routes. Max is 10 vehicles per request.`);
    }

    return fetch(`${BASE_PREDICTIONS_URL}&vid=${vehicleIds.join(',')}`)
        .then(res => res.json())
        .then(json => json['bustime-response']['prd']);
}

async function getEvergreenRouteData(routeId: string) {
    // Use cached data if it is available
    if (evergreenRouteData[routeId]) {
        console.log(`Returning cached evergreen data for route ${routeId}.`);
        return Promise.resolve(evergreenRouteData[routeId]);
    }

    console.log(`Fetching evergreen data from route ${routeId}.`);
    const directions = await fetch(`${BASE_DIRECTIONS_URL}&rt=${routeId}`)
        .then(res => res.json())
        .then(json => json['bustime-response']['directions'].map(direction => direction.dir));

    const rawData = await Promise.all([
        fetch(
            `${BASE_PATTERNS_URL}&rt=${routeId}&format=json`
        )
            .then(res => res.json())
            .then(json => json['bustime-response']['ptr']),
        ...directions.map(dir => (
            fetch(
                `${BASE_STOPS_URL}&rt=${routeId}&dir=${dir}`
            )
                .then(res => res.json())
                .then(json => json['bustime-response']['stops'])
        )),
    ]);

    const [patterns, ...stopsByDirection] = rawData;

    const stops = {};
    directions.forEach((direction, i) => {
        stops[direction] = stopsByDirection[i];
    });

    const routeDataObj =  {
        directions,
        patterns,
        stops
    };

    // Cache data object
    evergreenRouteData[routeId] = routeDataObj;

    return routeDataObj;
}
