import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule, } from '@ng-bootstrap/ng-bootstrap';
import { WorkProcessesRoutingModule } from '../work-processes/work-processes-routing.module';

import { DispatchProcessesRoutingModule } from './dispatch-processes-routing.module';
import { DispatchProcessesComponent } from './dispatch-processes.component';

@NgModule({
  imports: [
    CommonModule,
    DispatchProcessesRoutingModule,
    WorkProcessesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  declarations: [DispatchProcessesComponent],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
  ]
})
export class DispatchProcessesModule {}
