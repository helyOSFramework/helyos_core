import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { routerTransition } from '../router.animations';
import { HelyosService } from '../services/helyos.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  animations: [routerTransition()],
})
export class LoginComponent implements OnInit {
  public username: string;
  public password: string;
  public gqlPort: string = '5000';
  public wsPort: string = '5002';
  public runlocal: boolean = false;


  constructor(public router: Router, private helyosService: HelyosService) {
    this.runlocal = window.location.href.includes('localhost');
  }


  ngOnInit() {

    if (window.sessionStorage.getItem('runlocally') === 'true') {
      this.gqlPort = window.sessionStorage.getItem('gqlPort');
      this.wsPort = window.sessionStorage.getItem('wsPort');
      this.runlocal = true;
    }
  }

  onLoggedin() {

    if (this.runlocal) {
      this.helyosService.instantiateService(this.gqlPort, this.wsPort);
      window.sessionStorage.setItem('runlocally', 'true');
      window.sessionStorage.setItem('gqlPort', this.gqlPort);
      window.sessionStorage.setItem('wsPort', this.wsPort);
    } else {
      window.sessionStorage.setItem('runlocally', "false");
      this.helyosService.instantiateService();
    }

    return this.helyosService.methods.login(this.username, this.password)
      .then(response => {
        console.log("response login", response);

        if (response && response.jwtToken) {
          return this.helyosService.methods.connect()
            .then(() => {
              window.sessionStorage.setItem('token', response.jwtToken);
              console.log("helyos connected");
              window.sessionStorage.setItem('isLoggedin', 'true');
              this.router.navigate(['/all-services']);
              return true;
            })
            .catch(errorConnect => {
              alert(`Error connecting to helyos ${errorConnect.message}`);
              console.log(errorConnect);
              return false;
            });
        } else {
          if (response && response.graphQLErrors && response.graphQLErrors.length > 0) {
            alert('Username or password is incorrect');
          }
          return false;
        }

      })
      .catch(errorLogin => console.log(errorLogin));

  }

  changingServerMode() {
    this.runlocal = !this.runlocal;
    window.sessionStorage.removeItem('isLoggedin');
  }
}
