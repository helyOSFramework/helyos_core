import { YardmapModule } from './yardmap.module';

describe('YardmapModule', () => {
    let yardmapModule: YardmapModule;

    beforeEach(() => {
        yardmapModule = new YardmapModule();
    });

    it('should create an instance', () => {
        expect(yardmapModule).toBeTruthy();
    });
});
