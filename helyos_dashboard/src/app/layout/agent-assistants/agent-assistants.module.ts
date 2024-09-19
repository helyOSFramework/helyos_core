import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentAssistantsRoutingModule } from './agent-assistants-routing.module';
import { AgentAssistantsComponent } from './agent-assistants.component';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AgentAssistantsRoutingModule,
    FormsModule,
    NgbModule
  ],
  declarations: [AgentAssistantsComponent],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
  ]
})
export class AgentAssistantsModule { }
