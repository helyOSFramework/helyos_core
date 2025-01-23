import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { HelyosService } from 'src/app/services/helyos.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  public pushRightClass: string;
  public version: string = environment.version;
  public nameSpace: string = '';
  public rbmqHost: string = '';
  public vhost: string = '';
  
  constructor(private translate: TranslateService, public router: Router, private helyosService: HelyosService) {
    this.nameSpace = helyosService.nameSpace;
    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd && window.innerWidth <= 992 && this.isToggled()) {
        this.toggleSidebar();
      }
    });
  }

  ngOnInit() {
    this.pushRightClass = 'push-right';
    this.helyosService.methods.RBMQConfig.list({})
    .then( rv => {
      this.rbmqHost = rv && rv.length? rv[0].rbmqHost: '';
      this.vhost = rv && rv.length? rv[0].rbmqVhost: '';
    });
  }

  isToggled(): boolean {
    const dom: Element = document.querySelector('body');
    return dom.classList.contains(this.pushRightClass);
  }

  toggleSidebar() {
    const dom = document.querySelector('body');
    dom.classList.toggle(this.pushRightClass);
  }

  rltAndLtr() {
    const dom = document.querySelector('body');
    dom.classList.toggle('rtl');
  }

  onLoggedout() {
    window.sessionStorage.removeItem('isLoggedin');
  }

  changeLang(language: string) {
    this.translate.use(language);
  }
}
