import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SystemLogComponent } from './system-log.component';

const routes: Routes = [
    {
        path: '',
        component: SystemLogComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule, FormsModule]
})
export class SystemLogRoutingModule {}
