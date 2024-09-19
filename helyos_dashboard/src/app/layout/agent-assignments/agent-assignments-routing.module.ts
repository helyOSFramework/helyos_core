import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgentAssignmentsComponent } from './agent-assignments.component';

const routes: Routes = [
  {
    path: '',
    component: AgentAssignmentsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule
  ]
})
export class AgentAssignmentsRoutingModule { }

