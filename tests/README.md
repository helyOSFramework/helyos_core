# Running Integration Tests

To run the tests for the Helyos Core module, you will need to have Node.js installed on your machine.

## Prerequisites

- [Node.js](https://nodejs.org) - Make sure you have Node.js installed on your machine.
- [Docker](https://www.docker.com/get-started) - Make sure you have Docker and running.

## Running the Tests

1. Open a terminal or command prompt.

2. Navigate to the test directory.

3. Install the required dependencies by running the following command:

    ```bash
    npm install
    ```

4. Make sure you have Docker installed on your machine. If not, you can download and install it from [here](https://www.docker.com/get-started).

5. Once the dependencies and Docker are installed, you can run the tests using the following command:

    ```bash
    npm run test
    ```

    This command will execute the test suite using `Jest` and `TestContainers`. 
    helyos system logs produced during each test can be found in the folder `tests/logs`.


    If you encounter any issues starting the containers, try the command `docker network prune`. Please refer to the TestContainers [documentation](https://testcontainers.com/) for instructions on how to set
    TestContainers to inteface with your Docker client.

6. After running the tests, you will see the test results in the terminal or command prompt.

That's it! 