import { WorkProcessesModule } from './work-processes.module';

describe('WorkProcessesModule', () => {
  let workProcessesModule: WorkProcessesModule;

  beforeEach(() => {
    workProcessesModule = new WorkProcessesModule();
  });

  it('should create an instance', () => {
    expect(workProcessesModule).toBeTruthy();
  });
});
