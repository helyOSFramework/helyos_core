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
import initialization from './initialization';
import config from './config';

// Simple HTTP server imports
import http from 'http';
import express from 'express';
import fs from 'fs';

const DASHBOARD_DIR = '../helyos_dashboard/dist/';
const API_DOC_DIR = 'docs/';


// Test Settings: Override external services by `Nock` services (mocks).
// See the file microservice_mocks.js for more details.
const MOCK_SERVICES = process.env.MOCK_SERVICES;
if (MOCK_SERVICES === 'True') {
    // console.log = function() {};
    require('./microservice_mocks.js').overridePathPlannerCalls();
    require('./microservice_mocks.js').overrideMapServerCalls();
}



// ----------------------------------------------------------------------------
// 2) Postgres postgClient setup - Database Triggers Events using PG_NOTIFY
// This approach is not scalable, as PG_NOTIFY broadcasts to all listening clients.
// In a near future, we will use a message queue table to handle the database events.
// ----------------------------------------------------------------------------
const { handleDatabaseMessages } = require('./event_handlers/database_event_subscriber.js');
import databaseServices from './services/database/database_services';


async function connectToDB() {
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
        'new_rabbitmq_account',
        'change_rabbitmq_permissions'
    ];
    await databaseServices.subscribeToDatabaseEvents(postgClient, dBEventsToSubscribe);
    console.log(" ============  Subscribed to DB events ==================");
    return postgClient;
}





// ----------------------------------------------------------------------------
// 3) RabbitMQ Client setup -  Agent -> RabbitMQ ->  Nodejs(Rbmq-client) -> Postgres 
// ----------------------------------------------------------------------------
import rabbitMQServices from './services/message_broker/rabbitMQ_services';
const rabbitMQTopology = require('./rbmq_topology.js');


async function connectToRabbitMQ() {
    await initialization.initializeRabbitMQAccounts();
    const dataChannels = await rabbitMQServices.connectAndOpenChannels({
        subscribe: false,
        connect: true,
        recoverCallback: initialization.helyosConsumingMessages
    });
    // SET RABBITMQ EXCHANGE/QUEUES SCHEMA AND THEN SUBSCRIBE TO QUEUES
    await rabbitMQTopology.configureRabbitMQSchema(dataChannels);
    return dataChannels;

}


// ----------------------------------------------------------------------------
// 4) GraphQL server setup -  External App <-> Nodejs(GraphQL Lib) <-> Postgres
// ----------------------------------------------------------------------------
const { postgraphile } = require("postgraphile");
const { PGHOST, PGPORT,
        JWT_SECRET, PGDATABASE,
       postgraphileRolePassword } = config;


const postGraphileOptions = {
    watchPg: false,
    graphiql: true,
    enhanceGraphiql: true,
    retryOnInitFail: true,
    pgDefaultRole: "role_anonymous",
    bodySizeLimit: '5000kb',
    jwtSecret: JWT_SECRET,
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
        postgraphile(
            `postgres://role_postgraphile:${postgraphileRolePassword}@${PGHOST}:${PGPORT}/${PGDATABASE}`,
            "public",
            postGraphileOptions));

}



// ----------------------------------------------------------------------------
// 5) Serving the front-end dashboard - GUI for helyOS settings
// ---------------------------------------------------------------------------

const setDashboardServer = () => {
    const pubKey = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_public.key',{ encoding: 'utf8', flag: 'r' });
    const app = express();
    app.use('/api-docs', express.static(API_DOC_DIR));
    app.use('/dashboard', express.static(DASHBOARD_DIR));
    app.get('/public-key', (req, res) => {res.type('pem').send(pubKey);});
    app.use('/', (req, res, next) => res.redirect('/dashboard'));
    return app;
}


// ----------------------------------------------------------------------------
// 6) START
// ---------------------------------------------------------------------------
import { WebSocketService } from './services/socket_services';
import * as inMemmoryServices from './services/in_mem_database/mem_database_service';
const { DASHBOARD_PORT, SOCKET_PORT, GQLPORT, SOCKET_IO_ADAPTER } = config;

async function start() {
    try {
        const postgClient = await connectToDB();
        const webSocketService = await WebSocketService.getInstance();
        webSocketService.io.listen(SOCKET_PORT as number);

        let dataChannels = await connectToRabbitMQ();
        const frontEndServer = setDashboardServer();
        const graphqlServer = setGraphQLServer();

        await initialization.helyosConsumingMessages(dataChannels);
        initialization.initWatchers();
        await handleDatabaseMessages(postgClient, webSocketService);

        frontEndServer.listen(DASHBOARD_PORT, () => {
            console.log(`Dashboard server running on port ${DASHBOARD_PORT}`);
        });
        graphqlServer.listen(GQLPORT, () => {
            console.log(`GraphQL server running on port ${GQLPORT}`);
        });

    } catch (error) {
        console.error('Error during server startup:', error);
        await end();
        process.exit(1);
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Received SIGINT. Shutting down gracefully...');
        await end();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM. Shutting down gracefully...');
        await end();
        process.exit(0);
    });

}



async function end() {
    try {
        await rabbitMQServices.disconnect();
        console.log('Disconnected from RabbitMQ.');
        await inMemmoryServices.disconnect();
        console.log('Disconnected from REDIS.');
        await databaseServices.disconnectFromDB([databaseServices.client,
        databaseServices.shortTimeClient,
        databaseServices.pgNotifications]);
        console.log('Disconnected from all database services.');

    } catch (error) {
        console.error("At least one service disconnection failed", error);
    }
}



import cluster from 'cluster';
import { setupPrimary } from "@socket.io/cluster-adapter";
const { NUM_THREADS } = config;

if (cluster.isMaster && NUM_THREADS > 1) {

    console.log(`Master ${process.pid} is running`);
    if (SOCKET_IO_ADAPTER === 'cluster') {
        setupPrimary(); // Set up the socket_io connections between workers
    }

    for (let i = 0; i < NUM_THREADS; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.warn(`Worker ${worker.process.pid} died !`);
        cluster.fork();
    });

} else {
    // Workers will run in parallel
    console.log(`Worker ${process.pid} started`);
    start();
}


// Microservice API Documentation ----------------------------------------------
// The microservice API documentation is served at /api-docs/ path.
// AS swagger-ui cannot serve more than one documentation, each documentation is individually rendered by using the
// swagger script from UNPKG CDN, tagged the .html files. The api definition is loaded from the /api-docs/ as json file.
// You can optionally enable redoc-ui in the Dockerfile to compile a static html files at /srv/api_docs/, by uncommenting the following lines:
// # RUN npm run make_map_api_doc
// # RUN npm run make_path_api_doc







