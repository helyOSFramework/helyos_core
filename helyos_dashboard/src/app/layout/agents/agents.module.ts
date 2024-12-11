import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentsRoutingModule } from './agents-routing.module';
import { AgentsComponent } from './agents.component';

@NgModule({
  imports: [
    CommonModule,
    AgentsRoutingModule,
  ],
  declarations: [AgentsComponent],
})
export class AgentsModule { }

