import { DispatchServicesModule } from './dispatch-services.module';

describe('DispatchServicesModule', () => {
    let blankPageModule: DispatchServicesModule;

    beforeEach(() => {
        blankPageModule = new DispatchServicesModule();
    });

    it('should create an instance', () => {
        expect(blankPageModule).toBeTruthy();
    });
});
