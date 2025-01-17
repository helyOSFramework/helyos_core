import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentRegistComponent } from './agent-regist.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('AgentRegistComponent', () => {
  let component: AgentRegistComponent;
  let fixture: ComponentFixture<AgentRegistComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentRegistComponent],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
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
