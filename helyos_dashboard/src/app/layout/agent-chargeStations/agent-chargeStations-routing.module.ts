import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AgentChargeStationsComponent } from './agent-chargeStations.component';

const routes: Routes = [
  {
    path: '',
    component: AgentChargeStationsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule,
  ],
})
export class AgentChargeStationsRoutingModule { }
