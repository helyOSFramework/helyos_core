import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AllServicesRoutingModule } from './all-services-routing.module';
import { AllServicesComponent } from './all-services.component';

@NgModule({
    imports: [CommonModule, FormsModule, AllServicesRoutingModule],
    declarations: [AllServicesComponent]
})
export class AllServicesModule {}
