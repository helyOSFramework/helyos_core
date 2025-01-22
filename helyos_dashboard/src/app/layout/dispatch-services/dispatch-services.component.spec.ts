import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DispatchServicesComponent } from './dispatch-services.component';
import { FormsModule } from '@angular/forms';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('DispatchServicesComponent', () => {
  let component: DispatchServicesComponent;
  let fixture: ComponentFixture<DispatchServicesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DispatchServicesComponent],
      imports: [FormsModule],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
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
