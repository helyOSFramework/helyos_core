import { AgentChargeStationsModule } from './agent-chargeStations.module';

describe('AgentRegistModule', () => {
  let agentRegistModule: AgentChargeStationsModule;

  beforeEach(() => {
    agentRegistModule = new AgentChargeStationsModule();
  });

  it('should create an instance', () => {
    expect(agentRegistModule).toBeTruthy();
  });
    
});
