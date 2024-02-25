import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentVehiclesComponent } from './agent-vehicles.component';

describe('YardsComponent', () => {
    let component: AgentVehiclesComponent;
    let fixture: ComponentFixture<AgentVehiclesComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [AgentVehiclesComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(AgentVehiclesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
