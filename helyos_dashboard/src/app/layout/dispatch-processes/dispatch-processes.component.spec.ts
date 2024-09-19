import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DispatchProcessesComponent } from './dispatch-processes.component';

describe('DispatchProcessesComponent', () => {
  let component: DispatchProcessesComponent;
  let fixture: ComponentFixture<DispatchProcessesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DispatchProcessesComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DispatchProcessesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
