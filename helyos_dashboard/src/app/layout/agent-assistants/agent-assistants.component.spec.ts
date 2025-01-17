import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentAssistantsComponent } from './agent-assistants.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('YardsComponent', () => {
  let component: AgentAssistantsComponent;
  let fixture: ComponentFixture<AgentAssistantsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentAssistantsComponent],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AgentAssistantsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
