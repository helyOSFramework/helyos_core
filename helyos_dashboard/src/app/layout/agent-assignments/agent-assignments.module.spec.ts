import { AgentAssignmentsModule } from './agent-assignments.module';

describe('AgentAssignmentsModule', () => {
  let blankPageModule: AgentAssignmentsModule;

  beforeEach(() => {
    blankPageModule = new AgentAssignmentsModule();
  });

  it('should create an instance', () => {
    expect(blankPageModule).toBeTruthy();
  });
});
