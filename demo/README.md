# Helyos Core Server with RabbitMQ Docker Compose Example

This folder contains an example Docker Compose configuration for setting up a helyos Core Server that communicates with a single agent via RabbitMQ.

## Prerequisites

Before running the Docker Compose configuration, make sure you have the following installed on your machine:

- Docker: [Install Docker](https://docs.docker.com/get-docker/)
- Docker Compose: [Install Docker Compose](https://docs.docker.com/compose/install/)


## Running 

To run the Docker Compose configuration, use the following command:

```bash
    docker-compose up
```

When the helyOS core is running locally, you should be able to access the dashboard at http://localhost:8080 and the GraphQL interactive interface at http://localhost:5000/graphiql.

**username**: admin
**password**: admin