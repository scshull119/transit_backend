const ctaBusTrackerKey = process.env.CTA_BUS_API_KEY;

// Cache object to store fetched data with route ID as key.
const routeData = {};

// For now, fetch and cache only pre-selected routes.
// In future concatenate all recently-requested routes to fetch list.
const alwaysRefreshRoutes = [74, 76];

