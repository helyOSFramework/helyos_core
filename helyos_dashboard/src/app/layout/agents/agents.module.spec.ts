import { AgentsModule } from './agents.module';

describe('AgentsModule', () => {
    let blankPageModule: AgentsModule;

    beforeEach(() => {
        blankPageModule = new AgentsModule();
    });

    it('should create an instance', () => {
        expect(blankPageModule).toBeTruthy();
    });
});
