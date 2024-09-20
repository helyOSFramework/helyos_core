import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DispatchServicesComponent } from './dispatch-services.component';

describe('DispatchServicesComponent', () => {
  let component: DispatchServicesComponent;
  let fixture: ComponentFixture<DispatchServicesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DispatchServicesComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DispatchServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
