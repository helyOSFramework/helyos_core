import { Injectable } from '@angular/core';
import { HelyosServices } from 'helyosjs-sdk';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HelyosService {
  helyosURL: string;
  methods: HelyosServices;
  nameSpace: string;

  constructor() {
    const httpOrhttps = window.location.protocol;
    const pathSegments = window.location.pathname.split('/').filter(segment => segment.length > 0);
    this.nameSpace = pathSegments.length > 0 && pathSegments[0] !== 'dashboard' ? `${pathSegments[0]}` : '';
    this.helyosURL = `${httpOrhttps}//${location.hostname}`; //'http://localhost';

    window.sessionStorage.setItem('nameSpace', this.nameSpace);
    

    let gqlPort = environment['gqlPort'];
    let wsPort = environment['socketPort'];

    if (window.sessionStorage.getItem('runlocally') === 'true') {
      gqlPort = window.sessionStorage.getItem('gqlPort');
      wsPort = window.sessionStorage.getItem('wsPort');
    }

    this.instantiateService(gqlPort, wsPort);

    if (window.sessionStorage.getItem('isLoggedin') === 'true') {
      const token = window.sessionStorage.getItem('token');
      if (token) {
        this.methods.token = token;
        this.methods.connect()
          .then(() => {
            console.log("helyos connected");
            return (true);

          }).catch(errorConnect => console.log(errorConnect));
      }
    }

    // console.log(this.methods);
  }

  instantiateService(gqlPort = null, socketPort = null) {
    if (!gqlPort) {
      gqlPort = environment['gqlPort'];
    }
    if (!socketPort) {
      socketPort = environment['socketPort'];
    }
    this.methods = new HelyosServices(this.helyosURL, {
      socketPort,
      gqlPort,
      path:this.nameSpace
    });
  }

}
