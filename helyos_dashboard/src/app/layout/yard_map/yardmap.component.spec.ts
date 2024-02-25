import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { YardmapComponent } from './yardmap.component';

describe('YardmapComponent', () => {
    let component: YardmapComponent;
    let fixture: ComponentFixture<YardmapComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [YardmapComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(YardmapComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
