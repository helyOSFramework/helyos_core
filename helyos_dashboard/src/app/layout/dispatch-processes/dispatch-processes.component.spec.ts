import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DispatchProcessesComponent } from './dispatch-processes.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('DispatchProcessesComponent', () => {
  let component: DispatchProcessesComponent;
  let fixture: ComponentFixture<DispatchProcessesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DispatchProcessesComponent],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
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
