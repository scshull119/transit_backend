import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Buffer } from 'node:buffer';
import { getBusRouteData } from './ctabus.js';

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

    type Prediction {
        tmstmp: String
        typ: String
        stpnm: String
        stpid: String
        vid: String
        dstp: Int
        rt: String
        rtdd: String
        rtdir: String
        des: String
        prdtm: String
        tablockid: String
        tatripid: String
        origtatripno: String
        dly: Boolean
        prdctdn: String
        zone: String
    }

    type BusVehicle {
        vid: String
        lat: String
        lon: String
        hdg: String
        pid: String
        rt: String
        des: String
        pdist: Int
        dly: Boolean
        tatripid: String
        origtatripno: String
        tablockid: String
        zone: String
        predictions: [Prediction]
    }

    type BusRoute {
        id: String
        rtnm: String
        directions: [String]
        vehicles: [BusVehicle]
        patterns: [Pattern]
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
        busRoute: (_, args) => getBusRouteData(args.id),
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});

console.log(`🚎 🚉  Server ready at: ${url}`);
