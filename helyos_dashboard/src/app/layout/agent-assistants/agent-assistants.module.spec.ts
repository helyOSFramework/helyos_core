import { AgentAssistantsModule } from './agent-assistants.module';

describe('AgentRegistModule', () => {
  let agentRegistModule: AgentAssistantsModule;

  beforeEach(() => {
    agentRegistModule = new AgentAssistantsModule();
  });

  it('should create an instance', () => {
    expect(agentRegistModule).toBeTruthy();
  });
    
});
