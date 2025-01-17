import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AgentToolsComponent } from './agent-tools.component';
import { MockHelyosService } from 'src/app/mocks/helyos.service.mock';
import { HelyosService } from 'src/app/services/helyos.service';

describe('YardsComponent', () => {
  let component: AgentToolsComponent;
  let fixture: ComponentFixture<AgentToolsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AgentToolsComponent],
      providers: [
        { provide: HelyosService, useClass: MockHelyosService }
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AgentToolsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
