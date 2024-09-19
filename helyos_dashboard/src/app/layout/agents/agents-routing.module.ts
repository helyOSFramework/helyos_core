import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AgentsComponent } from './agents.component';

const routes: Routes = [
  {
    path: '',
    component: AgentsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule,
  ],
})
export class AgentsRoutingModule { }
