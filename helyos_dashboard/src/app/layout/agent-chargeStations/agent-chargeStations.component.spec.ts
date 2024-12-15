import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentChargeStationsComponent } from './agent-chargeStations.component';

describe('YardsComponent', () => {
  let component: AgentChargeStationsComponent;
  let fixture: ComponentFixture<AgentChargeStationsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentChargeStationsComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AgentChargeStationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
