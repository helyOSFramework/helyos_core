import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AgentVehiclesComponent } from './agent-vehicles.component';

const routes: Routes = [
  {
    path: '',
    component: AgentVehiclesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule,
  ],
})
export class AgentVehiclesRoutingModule { }
