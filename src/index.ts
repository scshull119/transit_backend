import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Buffer } from 'node:buffer';

// Metra Rail data loading
const metraU = process.env.METRA_API_USERNAME;
const metraP = process.env.METRA_API_PASSWORD;

const convBuffer = Buffer.from(`${metraU}:${metraP}`, 'utf-8');
const authString = convBuffer.toString('base64');
const metraData = await fetch('https://gtfsapi.metrarail.com/gtfs/positions', {
    headers: {
        'Authorization': `Basic ${authString}`
    }
}).then(res => res.json());

// CTA bus data loading
const ctaBusTrackerKey = process.env.CTA_BUS_API_KEY;

const routeData = await fetch(
    `https://ctabustracker.com/bustime/api/v2/getroutes?key=${ctaBusTrackerKey}&format=json`
)
    .then(res => res.json())
    .then(json => json['bustime-response']['routes']);

const routeLookup = {};
routeData.forEach(route => {
    routeLookup[route.rt] = route;
});

async function fetchBusRouteData(route: string) {
    let vehicles = await fetch(
        `https://www.ctabustracker.com/bustime/api/v2/getvehicles?key=${ctaBusTrackerKey}&rt=${route}&format=json`
    )
        .then(res => res.json())
        .then(json => json['bustime-response']['vehicle']);

    const directions = await fetch(
        `http://www.ctabustracker.com/bustime/api/v2/getdirections?key=${ctaBusTrackerKey}&rt=${route}&format=json`
    )
        .then(res => res.json())
        .then(json => json['bustime-response']['directions'].map(direction => direction.dir));

    const stops = await Promise.all(directions.map(direction => (
        fetch(
            `http://www.ctabustracker.com/bustime/api/v2/getstops?key=${ctaBusTrackerKey}&rt=${route}&dir=${direction}&format=json`
        )
            .then(res => res.json())
            .then(json => json['bustime-response']['stops'])
    )));

    const patterns = await fetch(
        `http://www.ctabustracker.com/bustime/api/v2/getpatterns?key=${ctaBusTrackerKey}&rt=${route}&format=json`
    )
        .then(res => res.json())
        .then(json => json['bustime-response']['ptr']);
    const patternsLookup = {};
    patterns.forEach(pattern => {
        patternsLookup[pattern.pid] = pattern;
    });

    vehicles = vehicles.map(vehicle => {
        vehicle.pattern = patternsLookup[vehicle.pid];
        delete vehicle.pid;
        return vehicle;
    });

    return {
        id: routeLookup[route].rt,
        rtnm: routeLookup[route].rtnm,
        directions,
        stops,
        patterns,
        vehicles
    }
}

const preloadBusRoutes = ['74', '76'];
const busRouteData = await Promise.all(preloadBusRoutes.map(route => fetchBusRouteData(route)));
const busRouteLookup = {};
busRouteData.forEach(route => {
    busRouteLookup[route.id] = route;
});

// CTA train data loading
// const ctaTrainTrackerKey = process.env.CTA_RAIL_API_KEY;

const typeDefs = `#graphql
    type Train {
        id: String
    }

    type Point {
        seq: Int
        lat: Float
        lon: Float
        typ: String
        stpid: String
        stpnm: String
        pdist: Int
    }

    type Pattern {
        pid: Int
        ln: Int
        rtdir: String
        pt: [Point]
    }

    type BusVehicle {
        vid: String
        lat: String
        lon: String
        hdg: String
        pattern: Pattern
        rt: String
        des: String
        pdist: Int
        dly: Boolean
        tatripid: String
        origtatripno: String
        tablockid: String
        zone: String
    }

    type BusRoute {
        id: String
        rtnm: String
        directions: [String]
        vehicles: [BusVehicle]
    }

    type Cta {
        busRoute(id: String!): BusRoute
    }

    type Metra {
        trains: [Train]
    }

    type Query {
        cta: Cta
        metra: Metra
    }
`;

const resolvers = {
    Query: {
        metra: () => ({ trains: metraData }),
        cta: () => ({}),
    },
    Cta: {
        busRoute: (_, args) => busRouteLookup[args.id],
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});

console.log(`🚀  Server ready at: ${url}`);
