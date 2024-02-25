import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentToolsComponent } from './agent-chargeStations.component';

describe('YardsComponent', () => {
    let component: AgentToolsComponent;
    let fixture: ComponentFixture<AgentToolsComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [AgentToolsComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(AgentToolsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
