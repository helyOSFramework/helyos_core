import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { H_WorkProcessType } from 'helyosjs-sdk';
import { TranslateService } from '@ngx-translate/core';
import { HelyosService } from '../../../services/helyos.service';
import { AppService } from 'src/app/services/app.service';

interface IAgent {
  name: string;
  icon: string;
  route: string;
}

interface ILanguage {
  language: string;
  code: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, AfterViewInit {
  isActive: boolean;
  collapsed: boolean;
  showMenu: string;
  pushRightClass: string;
  agents: IAgent[] = [
    {
      name: 'Vehicles',
      icon: 'fa-truck',
      route: '/vehicles-registry',
    },
    {
      name: 'Tools & Trailers',
      icon: 'fa-trailer',
      route: '/tools-registry',
    },
    {
      name: 'Charge Stations',
      icon: 'fa-charging-station',
      route: '/chargeStations-registry',
    },
    {
      name: 'Assistants',
      icon: 'fa-robot',
      route: '/assistants-registry',
    },
    {
      name: 'Track Agents',
      icon: 'data-viewer-svgrepo-27503.svg',
      route: '/agents',
    },
  ];
  languages: ILanguage[] = [
    {
      language: 'English',
      code: 'en',
    },
    {
      language: 'French',
      code: 'fr',
    },
    {
      language: 'Urdu',
      code: 'ur',
    },
    {
      language: 'Spanish',
      code: 'es',
    },
    {
      language: 'Italian',
      code: 'it',
    },
    {
      language: 'Farsi',
      code: 'fa',
    },
    {
      language: 'German',
      code: 'de',
    },
  ];

  @Output() collapsedEvent = new EventEmitter<boolean>();

  public wpTypes: H_WorkProcessType[];

  constructor(private helyosService: HelyosService, private translate: TranslateService, public router: Router, private appService: AppService) {
    this.router.events.subscribe((val) => {
      if (val instanceof NavigationEnd && window.innerWidth <= 992 && this.isToggled()) {
        this.toggleSidebar();
      }
    });
  }

  ngOnInit() {
    this.isActive = false;
    this.collapsed = false;
    this.showMenu = '';
    this.pushRightClass = 'push-right';
  }

  ngAfterViewInit(): void {
    this.workProcTypesList();
    this.appService.enableTooltips();
  }

  workProcTypesList() {
    try {
      return this.helyosService.methods.workProcessType.list({})
        .then(r => {
          this.wpTypes = r;
          return this.wpTypes;
        });

    } catch (error) {
      return;
    }

  }

  eventCalled() {
    this.isActive = !this.isActive;
  }

  addExpandClass(element: string) {
    if (element === this.showMenu) {
      this.showMenu = '0';
    } else {
      this.showMenu = element;
    }
    this.showSidebar();
    this.workProcTypesList();
  }

  toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this.collapsedEvent.emit(this.collapsed);
  }

  showSidebar() {
    this.collapsed = false;
    this.collapsedEvent.emit(this.collapsed);
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

  changeLang(language: string) {
    this.translate.use(language);
  }

  onLoggedout() {
    window.sessionStorage.removeItem('isLoggedin');
  }
}
