import { AgentRegistModule } from './agent-regist.module';

describe('AgentRegistModule', () => {
  let agentRegistModule: AgentRegistModule;

  beforeEach(() => {
    agentRegistModule = new AgentRegistModule();
  });

  it('should create an instance', () => {
    expect(agentRegistModule).toBeTruthy();
  });
    
});
