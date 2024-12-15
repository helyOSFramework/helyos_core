import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentRegistComponent } from './agent-regist.component';

describe('AgentRegistComponent', () => {
  let component: AgentRegistComponent;
  let fixture: ComponentFixture<AgentRegistComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentRegistComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AgentRegistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
