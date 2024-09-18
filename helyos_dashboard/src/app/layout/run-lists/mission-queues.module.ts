import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule, } from '@ng-bootstrap/ng-bootstrap';
import { WorkProcessesRoutingModule } from '../work-processes/work-processes-routing.module';

import { RunListsRoutingModule } from './mission-queues-routing.module';
import { RunListsComponent } from './mission-queues.component';

@NgModule({
    imports: [
        CommonModule,
        RunListsRoutingModule,
        WorkProcessesRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        NgbModule
    ],
    declarations: [RunListsComponent],
    providers: [
        { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
    ]
})
export class RunListsModule {}
