import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentToolsComponent } from './agent-tools.component';

describe('YardsComponent', () => {
  let component: AgentToolsComponent;
  let fixture: ComponentFixture<AgentToolsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentToolsComponent],
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
