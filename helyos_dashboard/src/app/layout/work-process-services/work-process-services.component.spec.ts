import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WorkProcessServicesComponent } from './work-process-services.component';

describe('WorkProcessServicesComponent', () => {
  let component: WorkProcessServicesComponent;
  let fixture: ComponentFixture<WorkProcessServicesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [WorkProcessServicesComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkProcessServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
