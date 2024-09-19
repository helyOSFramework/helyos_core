import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentAssistantsComponent } from './agent-assistants.component';

describe('YardsComponent', () => {
  let component: AgentAssistantsComponent;
  let fixture: ComponentFixture<AgentAssistantsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentAssistantsComponent]
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
