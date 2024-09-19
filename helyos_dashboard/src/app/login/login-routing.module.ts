import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login.component';

const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  }
];

@NgModule({
  imports:[RouterModule.forChild(routes)
        
  ],
  exports: [
    RouterModule,
    FormsModule
  ]
})
export class LoginRoutingModule {}
