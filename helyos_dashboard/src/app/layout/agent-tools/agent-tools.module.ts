import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentToolsRoutingModule } from './agent-tools-routing.module';
import { AgentToolsComponent } from './agent-tools.component';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AgentToolsRoutingModule,
    FormsModule,
    NgbModule,
  ],
  declarations: [AgentToolsComponent],
  providers: [
    {
      provide: NgbDateAdapter,
      useClass: NgbDateNativeAdapter,
    },
  ],
})
export class AgentToolsModule { }
