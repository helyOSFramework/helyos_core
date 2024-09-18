import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { YardsRoutingModule } from './yards-routing.module';
import { YardsComponent } from './yards.component';

@NgModule({
    imports: [
        CommonModule,
        YardsRoutingModule
    ],
    declarations: [YardsComponent]
})
export class YardsModule {}
