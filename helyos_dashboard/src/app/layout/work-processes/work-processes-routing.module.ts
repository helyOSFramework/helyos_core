import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WorkProcessesComponent } from './work-processes.component';

const routes: Routes = [
  {
    path: '',
    component: WorkProcessesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WorkProcessesRoutingModule { }
