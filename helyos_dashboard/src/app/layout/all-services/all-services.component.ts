import { Component, OnInit } from '@angular/core';
import {  H_Service, H_Yard } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';

@Component({
    selector: 'app-all-services',
    templateUrl: './all-services.component.html',
    styleUrls: ['./all-services.component.scss']
})
export class AllServicesComponent implements OnInit {
    public services: H_Service[];
    public selectedItem: H_Service;
    public showDescription: boolean = false;

    constructor(private helyosService: HelyosService) {

    }

    ngOnInit() {
        this.list();
    }


    list() {
       return this.helyosService.methods.extServices.list({})
        .then( r => this.services = r );
    }


    create() {
        const newItem={name:'Unnamed'}
        this.helyosService.methods.extServices.create(newItem)
        .then( r=> {
            console.log(r)
            this.list().then( () =>  this.getItem(r.id) )
           
        });
    }

    getItem(itemId) {
        this.helyosService.methods.extServices.get(itemId)
        .then( r=> {
            this.selectedItem = r;
        });
    }

    delete(itemId) {
        if (confirm('Are you sure you want to delete?')) {
            this.helyosService.methods.extServices.delete(itemId)
            .then( r=>  this.list());
        }
    }

    editItem(item) {
        const patch = {...item};
        delete patch.createdAt;
        delete patch.modifiedAt;
        this.helyosService.methods.extServices.patch(patch)
        .then( r=>  {
            this.list();
            alert('changes saved');
        });
    }


    openMapAPIDoc(){
        window.open('/api-docs/map_api.html', '_blank');
    }

    openPPAPIDoc(){
        window.open('/api-docs/path_api.html', '_blank');
    }

    toggleEnable(item) {
        return this.helyosService.methods.extServices.patch({id: item.id, enabled: !item.enabled})
        .then( r => {
            item.enabled = !item.enabled;
            this.list();
        });
    }
}