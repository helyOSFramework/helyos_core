import { AllServicesModule } from './all-services.module';

describe('AllServicesModule', () => {
  let blankPageModule: AllServicesModule;

  beforeEach(() => {
    blankPageModule = new AllServicesModule();
  });

  it('should create an instance', () => {
    expect(blankPageModule).toBeTruthy();
  });
});
