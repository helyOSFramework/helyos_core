import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DispatchServicesComponent } from './dispatch-services.component';

describe('DispatchServicesComponent', () => {
    let component: DispatchServicesComponent;
    let fixture: ComponentFixture<DispatchServicesComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [DispatchServicesComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(DispatchServicesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
