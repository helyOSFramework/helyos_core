import { YardsModule } from './yards.module';

describe('YardsModule', () => {
    let yardsModule: YardsModule;

    beforeEach(() => {
        yardsModule = new YardsModule();
    });

    it('should create an instance', () => {
        expect(yardsModule).toBeTruthy();
    });
});
