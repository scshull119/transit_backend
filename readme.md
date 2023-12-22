# Transit Backend Microservice
This application is a microservice for collecting and serving real-time information on Chicago-area transit services. It polls the respective transit provider APIs at regular intervals and serves status data from memory.  It makes data available to consuming applications via a GraphQL API.

## Technical Implementation
### Requirements
* Node 20 or newer

### Usage
1. `nvm use` (if using [NVM](https://github.com/nvm-sh/nvm) to manage Node versions)
2. `npm install`
3. `npm run start`

### Data Sources
* [CTA Train Tracker API](https://www.transitchicago.com/developers/traintracker/)
* [CTA Bus Tracker API](https://www.transitchicago.com/developers/bustracker/)
* [Metra GTFS API](https://metra.com/developers)

### Related Documentation
* [GraphQL](https://graphql.org/learn/)
* [Apollo Server](https://www.apollographql.com/docs/apollo-server/)
