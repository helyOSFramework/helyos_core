import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WorkProcessServicesRoutingModule } from './work-process-services-routing.module';
import { WorkProcessServicesComponent } from './work-process-services.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    WorkProcessServicesRoutingModule,
  ],
  declarations: [WorkProcessServicesComponent],
})
export class WorkProcessServicesModule { }
