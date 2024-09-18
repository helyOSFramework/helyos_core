import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { WorkProcessesRoutingModule } from './work-processes-routing.module';
import { WorkProcessesComponent } from './work-processes.component';

@NgModule({
    imports: [CommonModule,
        FormsModule,
        WorkProcessesRoutingModule],
    declarations: [WorkProcessesComponent]
})
export class WorkProcessesModule {}
