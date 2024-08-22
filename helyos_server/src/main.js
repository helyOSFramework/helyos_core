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
//  1) Settings
//  2) Postgres client setup
//  3) RabbitMQ client setup
//  4) GraphQL server setup
//  5) Dashboard server setup
//  ===========================
//  EVENTS HANDLERS
//  handleDatabaseMessages - handle data base events
//  handleBrokerMessages - handle rabbitmq events


// ----------------------------------------------------------------------------
// 1) Settings
// ----------------------------------------------------------------------------
const DASHBOARD_DIR = '../helyos_dashboard/dist/';
const API_DOC_DIR = 'docs/';
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 8080;
const SOCKET_PORT = process.env.SOCKET_PORT || 5002
const GQLPORT = process.env.GQLPORT || 5000;
const PGPORT = process.env.PGPORT || 5432;

const JWT_SECRET = process.env.JWT_SECRET || 'keyboard_kitten';
const postgraphileRolePassword = process.env.PGPASSWORD || 'xyz';
const PGHOST = process.env.PGHOST || 'localhost';
const PGDATABASE = process.env.PGDATABASE || 'helyos_db';

// Vertical scaling
const NUM_THREADS  =  parseInt(process.env.NUM_THREADS || '1');

// Test Settings: Override external services by `Nock` services (mocks).
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

const memDBServices = require('./services/in_mem_database/mem_database_service.js');
const databaseServices = require('./services/database/database_services.js');

async function connectToMemDB(){
    console.log("Connecting to In Memory Database...");
    const inMemDB = await memDBServices.getInstance();
    console.log("Connected");

    return inMemDB;
}

async function connectToDB (initialization) {
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
    return postgClient;
}





// ----------------------------------------------------------------------------
// 3) RabbitMQ Client setup -  Agent -> RabbitMQ ->  Nodejs(Rbmq-client) -> Postgres 
// ----------------------------------------------------------------------------

const RabbitMQServices = require('./services/message_broker/rabbitMQ_services.js');
const RabbitMQTopology = require('./rabbitMQ_topology.js');

async function connectToRabbitMQ(initialization) {

    await initialization.initializeRabbitMQAccounts();
    const dataChannels = await RabbitMQServices.connectAndOpenChannels({
                                                                    subscribe: false,
                                                                    connect: true,
                                                                    recoverCallback: initialization.initRabbitMQConsumerWatcher
                                                                    });
    // SET RABBITMQ EXCHANGE/QUEUES SCHEMA AND THEN SUBSCRIBE TO QUEUES
    await RabbitMQTopology.configureRabbitMQSchema(dataChannels);
    return dataChannels;
}



// ----------------------------------------------------------------------------
// 4) GraphQL server setup -  External App <-> Nodejs(GraphQL Lib) <-> Postgres
// ----------------------------------------------------------------------------
const { postgraphile } = require("postgraphile");

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

const setGraphQLServer = () => {
    return http.createServer(
        postgraphile(`postgres://role_postgraphile:${postgraphileRolePassword}@${PGHOST}:${PGPORT}/${PGDATABASE}`,
        "public",
        postGraphileOptions ));

}


// ----------------------------------------------------------------------------
// 5) Serving the front-end dashboard - GUI for helyOS settings
// ---------------------------------------------------------------------------
const http = require('http');
const express = require('express');
const initialization = require('./initialization.js');
const webSocketServices = require('./services/socket_services.js');

const setDashboardServer = () => {
    const app = express();
    app.use('/api-docs', express.static(API_DOC_DIR));
    app.use('/dashboard', express.static(DASHBOARD_DIR));
    app.use('/', (req, res, next) => res.redirect('/dashboard'));
    return app;
}


// ----------------------------------------------------------------------------
// 6) START
// ---------------------------------------------------------------------------
async function start() {
    const frontEndServer = setDashboardServer();
    const graphqlServer = setGraphQLServer();
    const inMemDB = await connectToMemDB();
    const websocket = await webSocketServices.setWebSocketServer(SOCKET_PORT);
    const postgClient = await connectToDB(initialization);
    const dataChannels = await connectToRabbitMQ(initialization);
    initialization.initRabbitMQConsumerWatcher(dataChannels);
    initialization.initWatchers();
    const {handleDatabaseMessages} = require('./event_handlers/database_event_subscriber.js');
    handleDatabaseMessages(postgClient, inMemDB);

    websocket.listen(SOCKET_PORT);
    frontEndServer.listen(DASHBOARD_PORT);
    graphqlServer.listen(GQLPORT);

}


const cluster = require('cluster');
const { setupPrimary } = require("@socket.io/cluster-adapter");

if (cluster.isMaster && NUM_THREADS>1) {

    console.log(`Master ${process.pid} is running`);
        if (webSocketServices.SOCKET_IO_ADAPTER === 'cluster'){
            setupPrimary(); // Set up the socket_io connections between workers
        }

        for (let i = 0; i < NUM_THREADS; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            console.log(`Worker ${worker.process.pid} died`);
            cluster.fork();
        });

} else {
    // Workers will run in parallel
    console.log(`Worker ${process.pid} started`);
    start();
}



// Microservice API Documentation
// ----------------------------------------------
// The microservice API documentation is available at the /api-docs/ path.
// Since swagger-ui can only serve a single documentation at a time, each documentation instance is individually rendered using the 
// Swagger script from the UNPKG CDN, tagged to the .html files. The API definition is loaded from the /api-docs/ path as a JSON file.
// Optionally, you can enable redoc-ui in the Dockerfile to compile static HTML files at /srv/api_docs/ by uncommenting the following lines:
// # RUN npm run make_map_api_doc
// # RUN npm run make_path_api_doc



