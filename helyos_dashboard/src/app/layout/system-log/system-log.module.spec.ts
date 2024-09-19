import { SystemLogModule } from './system-log.module';

describe('ServerErrorModule', () => {
  let serverErrorModule: SystemLogModule;

  beforeEach(() => {
    serverErrorModule = new SystemLogModule();
  });

  it('should create an instance', () => {
    expect(serverErrorModule).toBeTruthy();
  });
});
