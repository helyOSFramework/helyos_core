import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AgentAssistantsComponent } from './agent-assistants.component';

const routes: Routes = [
  {
    path: '',
    component: AgentAssistantsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule
  ]
})
export class AgentAssistantsRoutingModule { }
