import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { YardsComponent } from './yards.component';

const routes: Routes = [
    {
        path: '',
        component: YardsComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [
        RouterModule,
        FormsModule
    ]
})
export class YardsRoutingModule {}
