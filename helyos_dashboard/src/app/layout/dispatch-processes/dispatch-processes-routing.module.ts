import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DispatchProcessesComponent } from './dispatch-processes.component';

const routes: Routes = [
    {
        path: '',
        component: DispatchProcessesComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [
        RouterModule,
        FormsModule
    ]
})
export class DispatchProcessesRoutingModule {}

