import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WorkProcessesComponent } from './work-processes.component';

describe('WorkProcessesComponent', () => {
  let component: WorkProcessesComponent;
  let fixture: ComponentFixture<WorkProcessesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [WorkProcessesComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkProcessesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
