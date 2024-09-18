import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AgentRegistRoutingModule } from './agent-regist-routing.module';
import { AgentRegistComponent } from './agent-regist.component';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@NgModule({
    imports: [
        CommonModule,
        AgentRegistRoutingModule,
        FormsModule,
        NgbModule
    ],
    declarations: [AgentRegistComponent],
    providers: [
        { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
      ]
})
export class AgentRegistModule {}
