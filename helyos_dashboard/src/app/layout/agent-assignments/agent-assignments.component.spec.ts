import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentAssignmentsComponent } from './agent-assignments.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';
import { FormsModule } from '@angular/forms';

describe('AgentAssignmentsComponent', () => {
  let component: AgentAssignmentsComponent;
  let fixture: ComponentFixture<AgentAssignmentsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentAssignmentsComponent],
      imports: [FormsModule],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AgentAssignmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
