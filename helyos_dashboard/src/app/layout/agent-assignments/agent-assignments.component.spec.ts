import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentAssignmentsComponent } from './agent-assignments.component';

describe('AgentAssignmentsComponent', () => {
    let component: AgentAssignmentsComponent;
    let fixture: ComponentFixture<AgentAssignmentsComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [AgentAssignmentsComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(AgentAssignmentsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
