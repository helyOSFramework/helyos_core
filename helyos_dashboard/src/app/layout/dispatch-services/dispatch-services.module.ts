import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDateAdapter, NgbDateNativeAdapter, NgbModule, } from '@ng-bootstrap/ng-bootstrap';
import { WorkProcessesRoutingModule } from '../work-processes/work-processes-routing.module';

import { DispatchServicesRoutingModule } from './dispatch-services-routing.module';
import { DispatchServicesComponent } from './dispatch-services.component';

@NgModule({
    imports: [CommonModule, DispatchServicesRoutingModule, WorkProcessesRoutingModule, FormsModule, ReactiveFormsModule, NgbModule],
    declarations: [DispatchServicesComponent],
    providers: [
        { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter }
      ]
})
export class DispatchServicesModule {}
