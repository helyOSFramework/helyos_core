import { AgentToolsModule } from './agent-tools.module';

describe('AgentRegistModule', () => {
  let agentRegistModule: AgentToolsModule;

  beforeEach(() => {
    agentRegistModule = new AgentToolsModule();
  });

  it('should create an instance', () => {
    expect(agentRegistModule).toBeTruthy();
  });

});
