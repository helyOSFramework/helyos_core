import { DispatchProcessesModule } from './dispatch-processes.module';

describe('DispatchProcessesModule', () => {
  let blankPageModule: DispatchProcessesModule;

  beforeEach(() => {
    blankPageModule = new DispatchProcessesModule();
  });

  it('should create an instance', () => {
    expect(blankPageModule).toBeTruthy();
  });
});
