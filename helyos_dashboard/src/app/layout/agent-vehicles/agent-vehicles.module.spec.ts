import { AgentVehiclesModule } from './agent-vehicles.module';

describe('AgentRegistModule', () => {
  let agentRegistModule: AgentVehiclesModule;

  beforeEach(() => {
    agentRegistModule = new AgentVehiclesModule();
  });

  it('should create an instance', () => {
    expect(agentRegistModule).toBeTruthy();
  });

});
