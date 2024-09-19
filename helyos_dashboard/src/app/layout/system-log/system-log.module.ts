import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SystemLogRoutingModule } from './system-log-routing.module';
import { SystemLogComponent } from './system-log.component';

@NgModule({
  imports: [
    CommonModule,
    SystemLogRoutingModule,
  ],
  declarations: [SystemLogComponent],
})
export class SystemLogModule { }
