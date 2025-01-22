import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WorkProcessServicesComponent } from './work-process-services.component';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('WorkProcessServicesComponent', () => {
  let component: WorkProcessServicesComponent;
  let fixture: ComponentFixture<WorkProcessServicesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [WorkProcessServicesComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'id' ? '1' : null),
            }),
          },
        },
        { provide: HelyosService, useClass: MockHelyosService }
      ],
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
