import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentVehiclesRoutingModule } from './agent-vehicles-routing.module';
import { AgentVehiclesComponent } from './agent-vehicles.component';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AgentVehiclesRoutingModule,
    FormsModule,
    NgbModule,
  ],
  declarations: [AgentVehiclesComponent],
  providers: [
    {
      provide: NgbDateAdapter,
      useClass: NgbDateNativeAdapter, 
    },
  ],
})
export class AgentVehiclesModule { }
