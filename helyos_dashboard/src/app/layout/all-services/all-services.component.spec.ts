import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AllServicesComponent } from './all-services.component';

describe('AllServicesComponent', () => {
  let component: AllServicesComponent;
  let fixture: ComponentFixture<AllServicesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AllServicesComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AllServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
