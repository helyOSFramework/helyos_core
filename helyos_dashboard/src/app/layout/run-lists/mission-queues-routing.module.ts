import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RunListsComponent } from './mission-queues.component';

const routes: Routes = [
  {
    path: '',
    component: RunListsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule
  ]
})
export class RunListsRoutingModule { }

