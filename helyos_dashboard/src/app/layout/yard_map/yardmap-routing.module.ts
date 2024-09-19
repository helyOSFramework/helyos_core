import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { YardmapComponent } from './yardmap.component';

const routes: Routes = [
  {
    path: '',
    component: YardmapComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [
    RouterModule,
    FormsModule,
  ],
})
export class YardmapRoutingModule { }
