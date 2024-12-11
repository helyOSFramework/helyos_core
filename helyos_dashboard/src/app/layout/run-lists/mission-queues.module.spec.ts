import { RunListsModule } from './mission-queues.module';

describe('RunListsModule', () => {
  let blankPageModule: RunListsModule;

  beforeEach(() => {
    blankPageModule = new RunListsModule();
  });

  it('should create an instance', () => {
    expect(blankPageModule).toBeTruthy();
  });
});
