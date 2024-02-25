import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkProcessServicesComponent } from './work-process-services.component';

describe('WorkProcessServicesComponent', () => {
    let component: WorkProcessServicesComponent;
    let fixture: ComponentFixture<WorkProcessServicesComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [WorkProcessServicesComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(WorkProcessServicesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
