import { Component, OnInit } from '@angular/core';
import {  H_Service } from 'helyosjs-sdk';
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
  public requireMapObjectsInput: string;

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
        this.requireMapObjectsInput = r.requireMapObjects.join(', ');

      });
  }

  delete(itemId) {
    if (confirm('Are you sure you want to delete?')) {
      this.helyosService.methods.extServices.delete(itemId)
        .then( (_) =>  this.list());
    }
  }

  editItem(item) {
    const patch = {...item};
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch.requireMapObjects;

    if (!this.requireMapObjectsInput) {
      patch['requireMapObjects'] = [];
    } else {
      try {
        const jsonArray = this.requireMapObjectsInput.split(',').map(element => element.trim());
        patch['requireMapObjects'] = jsonArray;
      } catch (error) {
        alert('error: requireMapObjects must be an array of strings.')
        return;
      }
    } 


    this.helyosService.methods.extServices.patch(patch)
      .then( (_) =>  {
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
      .then( (_) => {
        item.enabled = !item.enabled;
        this.list();
      });
  }
}