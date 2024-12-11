import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable()
export class AuthGuard {
  constructor(private router: Router) { }

  canActivate() {
    if (window.sessionStorage.getItem('isLoggedin')) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
