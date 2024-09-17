import packageJson from '../../package.json';

export const environment = {
    production: true,
    gqlPort: '443',
    socketPort: '443',
    version: packageJson.version
};
