export class MockHelyosService {
  methods = {
    servciceRequests: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    RBMQConfig: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    assignments: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    yard: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    extServices: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    agents: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    missionQueue: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    userAccounts: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    workProcess: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    workProcessType: {
      list: jasmine.createSpy('list').and.returnValue(Promise.resolve([]))
    },
    socket: {
      on: jasmine.createSpy('on'),
      removeAllListeners: jasmine.createSpy('removeAllListeners'),
    },

    connectionId: 12345,
    connected: false,
    token: 'mockToken',
    ports: { socketPort: 'mockSocketPort', gqlPort: 'mockGqlPort' },
    url: 'mockUrl',
    username: 'mockUsername',

    connect: jasmine.createSpy('connect').and.returnValue(Promise.resolve(true)),
    register: jasmine.createSpy('register').and.returnValue(Promise.resolve({ id: 'mockId', createdAt: new Date() })),
    login: jasmine.createSpy('login').and.returnValue(Promise.resolve({ jwtToken: 'mockJwtToken' })),
    adminGetUserAuthToken: jasmine.createSpy('adminGetUserAuthToken').and.returnValue(Promise.resolve({ jwtToken: 'mockJwtToken' })),
    changePassword: jasmine.createSpy('changePassword').and.returnValue(Promise.resolve({ success: true })),
    adminChangePassword: jasmine.createSpy('adminChangePassword').and.returnValue(Promise.resolve({ success: true })),
    logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve({ msg: 'Logged out successfully' })),
    convertMMtoLatLng: jasmine.createSpy('convertMMtoLatLng').and.returnValue([]),
    convertLatLngToMM: jasmine.createSpy('convertLatLngToMM').and.returnValue([]),
  };
}
