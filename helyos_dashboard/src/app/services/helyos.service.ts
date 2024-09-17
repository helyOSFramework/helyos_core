import { Injectable } from '@angular/core';
import { HelyosServices} from 'helyosjs-sdk';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class HelyosService {
    helyosURL: string;
    methods: HelyosServices;

  constructor() {    
    const httpOrhttps = window.location.protocol;
    this.helyosURL = `${httpOrhttps}//${location.hostname}`; //'http://localhost';

    let gqlPort = environment['gqlPort'];
    let wsPort = environment['socketPort'];

    if (window.sessionStorage.getItem('runlocally') === 'true') {
      gqlPort = window.sessionStorage.getItem('gqlPort');
      wsPort = window.sessionStorage.getItem('wsPort');
    }

    this.instantiateService(gqlPort, wsPort);

    if (window.sessionStorage.getItem('isLoggedin') === 'true') {
        const token =  window.sessionStorage.getItem('token');
        if (token) {
            this.methods.token =  token;
            this.methods.connect()
            .then(() => {
                    console.log("helyos connected");
                    return(true);
        
                }).catch(errorConnect =>console.log(errorConnect));
        }
    }

    console.log(this.methods)
   }


   instantiateService(gqlPort=null, socketPort=null){
     if(!gqlPort) { gqlPort = environment['gqlPort']}
     if(!socketPort) { socketPort = environment['socketPort']}
     this.methods = new HelyosServices(this.helyosURL, {socketPort, gqlPort});
   } 



}