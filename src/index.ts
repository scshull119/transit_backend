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
const route = '74,76';
const busData = await fetch(
    `https://www.ctabustracker.com/bustime/api/v2/getvehicles?key=${ctaBusTrackerKey}&rt=${route}&format=json`
).then(res => res.json());

// CTA train data loading
// const ctaTrainTrackerKey = process.env.CTA_RAIL_API_KEY;

const typeDefs = `#graphql
    type Train {
        id: String
    }

    type Bus {
        vid: String
        lat: String
        lon: String
        hdg: String
        pid: Int
        rt: String
        des: String
        pdist: Int
        dly: Boolean
        tatripid: String
        origtatripno: String
        tablockid: String
        zone: String
    }

    type Cta {
        buses: [Bus]
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
        cta: () => ({ buses: busData['bustime-response']['vehicle'] })
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
