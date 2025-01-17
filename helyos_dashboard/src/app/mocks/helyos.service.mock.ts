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
  };
}
