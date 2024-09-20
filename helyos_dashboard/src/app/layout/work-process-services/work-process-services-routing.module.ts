import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WorkProcessServicesComponent } from './work-process-services.component';

const routes: Routes = [
  {
    path: '',
    component: WorkProcessServicesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WorkProcessServicesRoutingModule { }
