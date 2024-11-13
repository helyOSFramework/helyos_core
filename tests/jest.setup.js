const { GenericContainer, Wait,  Network } = require('testcontainers');
const path = require('path');
const { get } = require('http');
// Containers
let postgresContainer;
let rabbitmqContainer;
let helyosCoreContainer;
let agentSimulatorContainer;
let agentSimulatorContainer2;
let network;
// Instances running on host machine
let helyosApplication;
let rabbitMQClient;

global.getHelyOSClientInstance= async () => {
    if(helyosApplication) {
        return helyosApplication;
    }
    return await setHelyOSClientInstance();
}

global.getRabbitMQClientInstance = async () => {
    if(rabbitMQClient) {
        return rabbitMQClient;
    }
    return await setRabbitMQClientInstance();
}


const setHelyOSClientInstance = async (helyosContainer) => {
  if (helyosContainer) {
    process.env.GRAPHQL_PORT = helyosContainer.getMappedPort(5000);
    process.env.SOCKET_PORT = helyosContainer.getMappedPort(5002);
    process.env.HOSTNAME = helyosContainer.getHost();
  }
  const {helyosClientApplication} = require('./helyos_client_app');
  await helyosClientApplication.login('admin', 'admin');
  return helyosClientApplication;
}


const setRabbitMQClientInstance = async (rabbitmqContainer) => {
    if (rabbitmqContainer) {
      process.env.RBMQ_HOST =  rabbitmqContainer.getHost();
      process.env.RBMQ_PORT =  rabbitmqContainer.getMappedPort(5672);
    }
    const {rabbitMQClient} = require('./helyos_agent_assistant');
    await rabbitMQClient.login('ASSISTANT_AGENT', 'helyos_secret');
    return rabbitMQClient;
}



const wait5seconds = () => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    clearTimeout(timeout);
    resolve();
  }, 5000);
});


beforeAll(async () => {
    const TEST_NUMBER = process.env.TEST_NUMBER;

    const postgresContainerName = `db_hostname_${TEST_NUMBER}_${process.env.JEST_WORKER_ID}`;
    const rabbitmqContainerName = `rbmq_hostname_${TEST_NUMBER}_${process.env.JEST_WORKER_ID}`;
    const helyosContainerName = `helyos_core_${TEST_NUMBER}_${process.env.JEST_WORKER_ID}`;
    console.log(`setting up test ${TEST_NUMBER}`);

    network = await new Network().start();

    postgresContainer = await new GenericContainer('postgres:13')
      .withExposedPorts(5432)
      .withName(postgresContainerName)
      .withEnvironment({
            'POSTGRES_USER': 'helyos_db_admin',
            'POSTGRES_PASSWORD': 'helyos_secret'
      })
      .withNetwork(network)
      // .withLogConsumer(stream => {
      // stream.on("data", line => console.log(line));
      // stream.on("err", line => console.error(line));
      // stream.on("end", () => console.log("Stream closed"));
      // })
      .start();


    rabbitmqContainer = await new GenericContainer('rabbitmq:3-management')
      .withName(rabbitmqContainerName)
      .withExposedPorts(5672, 15672)
      .withWaitStrategy(Wait.forListeningPorts())
      .withNetwork(network)
      // .withLogConsumer(stream => {
      // stream.on("data", line => console.log(line));
      // stream.on("err", line => console.error(line));
      // stream.on("end", () => console.log("Stream closed"));
      // })
      .start();

    helyosCoreContainer = await new GenericContainer('helyosframework/helyos_core:test')
      .withName(helyosContainerName)
      .withNetworkAliases(helyosContainerName)
      .withExposedPorts(5000,5002)
      .withWaitStrategy(Wait.forListeningPorts())
      .withBindMounts([
        { source: path.join(__dirname, './settings/config'), target: '/etc/helyos/config/' },
        { source: path.join(__dirname, './settings/db_initial_data/'), target: '/etc/helyos/db_initial_data/' },
        { source: path.join(__dirname, './settings/rsa_keys/helyos_private.key'), target: '/etc/helyos/.ssl_keys/helyos_private.key' },
        { source: path.join(__dirname, './settings/rsa_keys/helyos_public.key'), target: '/etc/helyos/.ssl_keys/helyos_public.key' },
        { source: path.join(__dirname, `./fixtures/mock${TEST_NUMBER}_microservice.js`), target: '/usr/local/helyos_core/helyos_server/src/microservice_mocks.js'}
      ])
      .withEnvironment({
        'PGUSER': 'helyos_db_admin',
        'PGPASSWORD': 'helyos_secret',
        'PGHOST': postgresContainerName,
        'PGDATABASE': 'helyos_db',
        'PGPORT': '5432',
        'GQLPORT': '5000',
        'RBMQ_HOST': rabbitmqContainerName,
        'RBMQ_PORT': '5672',
        'RBMQ_API_PORT': '15672',
        'RBMQ_SSL': 'False',
        'RBMQ_API_SSL': 'False',
        // 'REDIS_HOST':'local_redis',
        // 'REDIS_PORT':'6379',
        // 'REDIS_PASSWORD':'mypass',
        'CREATE_RBMQ_ACCOUNTS': 'True',
        'RBMQ_ADMIN_USERNAME': 'helyos_rbmq_admin',
        'RBMQ_ADMIN_PASSWORD': 'helyos_secret',
        'AGENT_AUTO_REGISTER_TOKEN': '0001-0002-0003-0000-0004',
        'MOCK_SERVICES': 'True',
        'RUN_MODE': 'production',
        'MESSAGE_RATE_LIMIT': '50',
        'MESSAGE_UPDATE_LIMIT': '20'
      })
      .withNetwork(network)
      // .withLogConsumer(stream => {
      //   stream.on("data", line => console.log(line));
      //   stream.on("err", line => console.error(line));
      //   stream.on("end", () => console.log("Stream closed"));
      // })
      .start();

      await wait5seconds();


    agentSimulatorContainer = await new GenericContainer('helyosframework/helyos_agent_slim_simulator:0.8.2')
      .withEnvironment({
        'UUID': 'Ab34069fc5-fdgs-434b-b87e-f19c5435113',
        'ASSIGNMENT_FORMAT': 'trajectory',
        'NAME': 'MY_TRACTOR',
        'X0': '-28000',
        'Y0': '29000',
        'ORIENTATION': '0.329',
        'VELOCITY': '1.8',
        'VEHICLE_PARTS': '2',
        'YARD_UID': '1',
        'UPDATE_RATE': '10',
        'RBMQ_HOST': rabbitmqContainerName,
        'RBMQ_PORT': '5672',
        'REGISTRATION_TOKEN': '0001-0002-0003-0000-0004'
      })
      .withNetwork(network)
      .withCommand(['python', '-u', 'main.py'])
      // .withLogConsumer(stream => {
      //   stream.on("data", line => console.log(line));
      //   stream.on("err", line => console.error(line));
      //   stream.on("end", () => console.log("Stream closed"));
      // })
      .start();


      await wait5seconds();


      agentSimulatorContainer2 = await new GenericContainer('helyosframework/helyos_agent_slim_simulator:0.8.2')
      .withEnvironment({
        'UUID': 'Bb34069fc5-fdgs-434b-b87e-f19c5435113',
        'ASSIGNMENT_FORMAT': 'trajectory',
        'NAME': 'MY_TRACTOR',
        'X0': '-28000',
        'Y0': '29000',
        'ORIENTATION': '0.329',
        'VELOCITY': '1.8',
        'VEHICLE_PARTS': '2',
        'YARD_UID': '1',
        'UPDATE_RATE': '10',
        'RBMQ_HOST': rabbitmqContainerName,
        'RBMQ_PORT': '5672',
        'REGISTRATION_TOKEN': '0001-0002-0003-0000-0004'
      })
      .withNetwork(network)
      .withCommand(['python', '-u', 'main.py'])
      // .withLogConsumer(stream => {
      //   stream.on("data", line => console.log(line));
      //   stream.on("err", line => console.error(line));
      //   stream.on("end", () => console.log("Stream closed"));
      // })
      .start();

      helyosApplication = await setHelyOSClientInstance(helyosCoreContainer);
      await helyosApplication.waitAgentStatus(1, 'free');
      await helyosApplication.waitAgentStatus(2, 'free');

      await helyosApplication.createAssistantAgent('ASSISTANT_AGENT');
      rabbitMQClient = await setRabbitMQClientInstance(rabbitmqContainer); 

});



afterAll(async () => {
  const TEST_NUMBER = process.env.TEST_NUMBER;

  await helyosApplication.dumpLogsToFile(TEST_NUMBER);
  await helyosApplication.logout();
  await rabbitMQClient.close();

  await Promise.all([
    helyosCoreContainer.stop(),
    agentSimulatorContainer.stop(),
    agentSimulatorContainer2.stop(),
  ]);

  await Promise.all([
    postgresContainer.stop(),
    rabbitmqContainer.stop()
  ]);

  await network.stop();

});