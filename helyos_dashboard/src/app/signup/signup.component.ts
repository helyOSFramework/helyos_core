import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { routerTransition } from '../router.animations';
import { HelyosService } from '../services/helyos.service';

@Component({
    selector: 'app-signup',
    templateUrl: './signup.component.html',
    styleUrls: ['./signup.component.scss'],
    animations: [routerTransition()]
})
export class SignupComponent implements OnInit {
    public username: string;
    public password: string;
    public oldPassword: string;
    public confirmedPassword: string;

    constructor(public router: Router, private helyosService : HelyosService) {}

    ngOnInit() {}


    changePassword(){
    if (this.confirmedPassword!= this.password){
        alert('Password does not match');
    }

     this.helyosService.methods.changePassword(this.username, this.oldPassword,this.password)
     .catch((e)=> alert(JSON.stringify(e)));
    }
}
