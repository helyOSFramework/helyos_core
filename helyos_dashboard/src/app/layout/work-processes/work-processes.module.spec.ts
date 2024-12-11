import { WorkProcessesModule } from './work-processes.module';

describe('WorkProcessesModule', () => {
  let WorkProcessesModule: WorkProcessesModule;

  beforeEach(() => {
    WorkProcessesModule = new WorkProcessesModule();
  });

  it('should create an instance', () => {
    expect(WorkProcessesModule).toBeTruthy();
  });
});
