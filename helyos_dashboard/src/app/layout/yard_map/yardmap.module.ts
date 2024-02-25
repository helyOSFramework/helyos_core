import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { YardmapRoutingModule } from './yardmap-routing.module';
import { YardmapComponent } from './yardmap.component';

@NgModule({
    imports: [CommonModule, YardmapRoutingModule],
    declarations: [YardmapComponent]
})
export class YardmapModule {}
