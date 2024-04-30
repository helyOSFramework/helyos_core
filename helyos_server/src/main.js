/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

// ----------------------------------------------------------------------------
// HELYOS CORE - main.js
//
// The helyOS core is a microservice and assignment orchestrator. It is designed to handle events, specifically PostgreSQL database notifications and RabbitMQ messages.
// Websockets are utilized solely for sending notifications to the web client, not for receiving them.
// 
// The main.js is composed of
//  SETUP
//  1) IMPORTS
//  2) Postgres client setup
//  3) RabbitMQ client setup
//  4) GraphQL server setup
//  5) Dashboard server setup
//  ===========================
//  EVENTS HANDLERS
//  handleDatabaseMessages - handle data base events
//  handleBrokerMessages - handle rabbitmq events


// ----------------------------------------------------------------------------
// 1) IMPORTS 
// ----------------------------------------------------------------------------
const initialization = require('./initialization.js');

// Simple HTTP server imports
const http = require('http');
const express = require('express');
const path = require('path');
const DASHBOARD_DIR = '../helyos_dashboard/dist/';
const API_DOC_DIR = 'docs/';

// Settings for horizontal scaling
let HELYOS_REPLICA = process.env.HELYOS_REPLICA || 'false';
HELYOS_REPLICA = HELYOS_REPLICA === 'true';

// Test Settings: Override external services by `Nock` services (mocks).
// See the file microservice_mocks.js for more details.
const MOCK_SERVICES = process.env.MOCK_SERVICES;
if (MOCK_SERVICES === 'True'){
    // console.log = function() {};
    require('./microservice_mocks.js').overridePathPlannerCalls();
    require('./microservice_mocks.js').overrideMapServerCalls();
}



// ----------------------------------------------------------------------------
// 2) Postgres postgClient setup - Database Triggers Events using PG_NOTIFY
// This approach is not scalable, as PG_NOTIFY broadcasts to all listening clients.
// In a near future, we will use a message queue table to handle the database events.
// ----------------------------------------------------------------------------
const {handleDatabaseMessages} = require('./event_handlers/database_event_subscriber.js');
const databaseServices = require('./services/database/database_services.js');

async function connectToDB () {
    const postgClient = databaseServices.pgNotifications;
    console.log("============  Client connected with DB ==================");
    await initialization.setInitialDatabaseData();
    console.log(" ============  Configuration loaded ==================");
    const dBEventsToSubscribe = [
        'work_processes_insertion',
        'assignments_insertion',
        'service_requests_insertion',
        'instant_actions_insertion',
        'mission_queue_insertion',
        'work_processes_update',
        'assignments_status_update',
        'service_requests_update',
        'mission_queue_update',
        'change_agent_security',
        'change_agent_status',
        'agent_deletion',
        'new_rabbitmq_account'
      ];
    await databaseServices.subscribeToDatabaseEvents(postgClient, dBEventsToSubscribe);  
    console.log(" ============  Subscribed to DB events =================="); 

    await connectToRabbitMQ();
    initialization.initWatchers();
    console.log("============  Watchers Initialized  ==================");

    handleDatabaseMessages(postgClient);
}

connectToDB();


// ----------------------------------------------------------------------------
// 3) RabbitMQ Client setup -  Agent -> RabbitMQ ->  Nodejs(Rbmq-client) -> Postgres 
// ----------------------------------------------------------------------------
const RabbitMQServices = require('./services/message_broker/rabbitMQ_services.js');

function connectToRabbitMQ () {
       return initialization.initializeRabbitMQAccounts()
            .then(() => RabbitMQServices.connectAndOpenChannel({subscribe: false, connect: true, recoverCallback: initialization.helyosConsumingMessages}) )       
            .then( dataChannel => {
            // SET RABBITMQ EXCHANGE/QUEUES SCHEMA AND THEN SUBSCRIBE TO QUEUES
                    initialization.configureRabbitMQSchema(dataChannel)
                    .then( dataChannel => initialization.helyosConsumingMessages(dataChannel));
        })
}


// ----------------------------------------------------------------------------
// 4) GraphQL server setup -  External App <-> Nodejs(GraphQL Lib) <-> Postgres
// ----------------------------------------------------------------------------
const { postgraphile } = require("postgraphile");
const JWT_SECRET = process.env.JWT_SECRET || 'keyboard_kitten';
const postgraphileRolePassword = process.env.PGPASSWORD || 'xyz';


const postGraphileOptions = {
    watchPg: false,
    graphiql: true,
    enhanceGraphiql: true,
    retryOnInitFail: true,
    pgDefaultRole: "role_anonymous",
    bodySizeLimit: '5000kb',
    jwtSecret: JWT_SECRET,
    retryOnInitFail: true,
    jwtPgTypeIdentifier: "public.jwt_token",
    enableCors: true,
    disableQueryLog: true,
// showErrorStack: "json",
// dynamicJson: true,
// ignoreRBAC: false,
// ignoreIndexes: false,
// showErrorStack: "json",
// exportGqlSchemaPath: "schema.graphql",
// extendedErrors: ["hint", "detail", "errcode"],
    };




const graphqlServer = http
    .createServer(postgraphile(`postgres://role_postgraphile:${postgraphileRolePassword}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
                                "public",postGraphileOptions )).listen(process.env.GQLPORT);


// ----------------------------------------------------------------------------
// 5) Serving the front-end dashboard - GUI for helyOS settings
// ---------------------------------------------------------------------------
const app = express();
console.log("HELYOS_REPLICA", path.join(DASHBOARD_DIR, '/fadsfdsfsadfdfsadfsfsadafa/'));
    app.use('/api-docs', express.static(API_DOC_DIR));
    app.use('/dashboard', express.static(DASHBOARD_DIR));
    app.use('/', (req, res, next) => res.redirect('/dashboard'));

    app.listen(8080);


// Microservice API Documentation ----------------------------------------------
// The microservice API documentation is served at /api-docs/ path.
// AS swagger-ui cannot serve more than one documentation, each documentation is individually rendered by using the 
// swagger script from UNPKG CDN, tagged the .html files. The api definition is loaded from the /api-docs/ as json file.
// You can optionally enable redoc-ui in the Dockerfile to compile a static html files at /srv/api_docs/, by uncommenting the following lines:
// # RUN npm run make_map_api_doc
// # RUN npm run make_path_api_doc







