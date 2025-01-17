import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentChargeStationsComponent } from './agent-chargeStations.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('YardsComponent', () => {
  let component: AgentChargeStationsComponent;
  let fixture: ComponentFixture<AgentChargeStationsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentChargeStationsComponent],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
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
