import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DispatchServicesComponent } from './dispatch-services.component';

const routes: Routes = [
  {
    path: '',
    component: DispatchServicesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule,
  ],
})
export class DispatchServicesRoutingModule { }

