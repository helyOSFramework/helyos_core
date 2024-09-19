import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule, } from '@ng-bootstrap/ng-bootstrap';
import { WorkProcessesRoutingModule } from '../work-processes/work-processes-routing.module';

import { AgentAssignmentsRoutingModule } from './agent-assignments-routing.module';
import { AgentAssignmentsComponent } from './agent-assignments.component';

@NgModule({
  imports: [
    CommonModule,
    AgentAssignmentsRoutingModule,
    WorkProcessesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  declarations: [AgentAssignmentsComponent],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
  ]
})
export class AgentAssignmentsModule { }
