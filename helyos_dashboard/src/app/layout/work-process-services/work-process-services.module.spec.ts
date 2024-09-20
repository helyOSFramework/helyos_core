import { WorkProcessServicesModule } from './work-process-services.module';

describe('WorkProcessServicesModule', () => {
  let workProcessServicesModule: WorkProcessServicesModule;

  beforeEach(() => {
    workProcessServicesModule = new WorkProcessServicesModule();
  });

  it('should create an instance', () => {
    expect(workProcessServicesModule).toBeTruthy();
  });
});
