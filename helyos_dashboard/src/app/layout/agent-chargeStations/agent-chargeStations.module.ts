import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentChargeStationsRoutingModule } from './agent-chargeStations-routing.module';
import { AgentChargeStationsComponent } from './agent-chargeStations.component';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AgentChargeStationsRoutingModule,
    FormsModule,
    NgbModule,
  ],
  declarations: [AgentChargeStationsComponent],
  providers: [
    {
      provide: NgbDateAdapter,
      useClass: NgbDateNativeAdapter
    },
  ],
})
export class AgentChargeStationsModule { }
