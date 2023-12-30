import { chunkArray } from "./util";
const ctaBusTrackerKey = process.env.CTA_BUS_API_KEY;
const BASE_URL = 'https://www.ctabustracker.com/bustime/api/v2';
const BASE_VEHICLES_URL = `${BASE_URL}/getvehicles?key=${ctaBusTrackerKey}&format=json`;

// Cache object to store fetched data with route ID as key.
const routeData = {};

// For now, fetch and cache only pre-selected routes.
// In future concatenate all recently-requested routes to fetch list.
const alwaysRefreshRoutes = [74, 76];
let recentRoutes = [];

export async function getBusRouteData(routeId: string) {
    // TODO: Validate routeId and throw error if it is not a valid CTA bus route

    // If route data is already cached, just return the cached data.
    if (routeData[routeId]) {
        return routeData[routeId];
    }

    // Add requested route ID to recent routes
    // Shouldn't need to check if it's already there.
    // We know at this point that the requested route isn't cached, so it shouldn't be in recent routes either.

    // Fetch bus route data for the single requested route.
    return await fetchBusRoutesData([routeId]);
}

async function fetchBusRoutesData(routeIds) {
    const requestBatches = chunkArray(routeIds, 10);
    const batchResponses =  await Promise.all(requestBatches.map(batch => fetchBusRouteBatchData(batch)));

    // Flatten the batch responses into a single unified array
    return batchResponses.reduce((collector, batchResponse) => collector.concat(batchResponse), []);
}

async function fetchBusRouteBatchData(routeIds) {
    if (routeIds.length > 10) {
        throw new Error(`Requested route vehicle data for ${routeIds.length} routes. Max is 10 routes per request.`);
    }

    const vehicles =  await fetchVehiclesData(routeIds);
}

function fetchVehiclesData(routeIds) {
    return fetch(`${BASE_VEHICLES_URL}&rt=${routeIds.join(',')}`)
        .then(res => res.json())
        .then(json => json['bustime-response']['vehicle']);
}
