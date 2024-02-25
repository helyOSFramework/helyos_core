import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DispatchProcessesComponent } from './dispatch-processes.component';

describe('DispatchProcessesComponent', () => {
    let component: DispatchProcessesComponent;
    let fixture: ComponentFixture<DispatchProcessesComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [DispatchProcessesComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(DispatchProcessesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
