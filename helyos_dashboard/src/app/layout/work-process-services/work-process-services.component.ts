import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { H_Service, H_WorkProcessServicePlan, H_WorkProcessType } from 'helyosjs-sdk';
import { Subscription } from 'rxjs';
import { HelyosService } from '../../services/helyos.service';


@Component({
  selector: 'app-work-process-services',
  templateUrl: './work-process-services.component.html',
  styleUrls: ['./work-process-services.component.scss'],
})
export class WorkProcessServicesComponent implements OnInit, OnDestroy {
  public wpServPlan: H_WorkProcessServicePlan[];
  public selectedItem: H_WorkProcessServicePlan;
  private sub: Subscription;
  public wpTypeId: number;
  public wpType: H_WorkProcessType;
  public availableServiceTypes: string[];
  public availableSteps: string[];
  public addedDep: string;

  constructor(private helyosService: HelyosService, private activatedroute: ActivatedRoute) { }


  ngOnInit() {
    this.sub = this.activatedroute.paramMap.subscribe(params => {
      this.wpTypeId = parseInt(params.get('id'));
      this.helyosService.methods.workProcessType.get(params.get('id')).then(r => this.wpType = r);
      this.list();
    });

    this.helyosService.methods.extServices.list({}).then(r => {
      this.availableServiceTypes = [];
      r.forEach((service: H_Service) => {
        if (!this.availableServiceTypes.includes(service.serviceType)) {
          this.availableServiceTypes.push(service.serviceType);
        }
      });

    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  list() {
    return this.helyosService.methods.workProcessServicePlan.list({
      'workProcessTypeId': this.wpTypeId, 
    })
      .then(r => this.wpServPlan = r);
  }


  create() {
    const newItem = {
      step: 'X',
      workProcessTypeId: this.wpTypeId, 
    };
    this.helyosService.methods.workProcessServicePlan.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));
      });
  }



  returnObj(objString) {
    try {
      return JSON.parse(objString);

    } catch (error) {
      return objString;
    }
  }

  getItem(itemId) {
    this.helyosService.methods.workProcessServicePlan.get(itemId)
      .then(r => {
        this.selectedItem = r;
        this.selectedItem['_defaultConfig'] = !this.selectedItem.serviceConfig;
        if (!this.selectedItem['_defaultConfig']) {
          this.selectedItem.serviceConfig = JSON.stringify(this.selectedItem.serviceConfig);
        }
        this.addedDep = '';
        this.availableSteps = this.wpServPlan.filter(plan => {
          if (plan.id == r.id) return false;
          const dependsOnSteps = this.returnObj(plan.dependsOnSteps); // cannot depend of itself
          if (dependsOnSteps && dependsOnSteps.includes(r.step)) return false; // avoid recursive dependencies
          return true;
        }).map(plan => plan.step);
      });
  }


  deleteItem() {
    if (this.selectedItem) {
      this.helyosService.methods.workProcessServicePlan.delete(this.selectedItem.id as string)
        .then((_) => {
          this.list();
        });
    }
  }

  editItem(item) {
    const patch = {
      ...item, 
    };
    delete patch.createdAt;
    delete patch.modifiedAt;
    delete patch._defaultConfig;

    if (item['_defaultConfig']) {
      patch.serviceConfig = null;
    }

    if (!patch.serviceConfig) {
      patch.serviceConfig = null;
    } else {
      try {
        patch['serviceConfig'] = JSON.parse(item['serviceConfig']);
      } catch (error) {
        alert('error: serviceConfig is not a valid JSON.');
        return;
      }
    }

    this.helyosService.methods.workProcessServicePlan.patch(patch)
      .then((_) => {
        this.list();
      });
  }


  changeRadio(value) {
    this.selectedItem.isResultAssignment = !!value;
  }

  isAssignmentResult(ev) {
    console.log(ev);
  }



  addDependency(value) {
    if (!value) return;
    let dependsOnSteps = !this.selectedItem.dependsOnSteps ? [] : this.returnObj(this.selectedItem.dependsOnSteps);
    if (!dependsOnSteps.includes(value)) {
      dependsOnSteps.push(value);
      dependsOnSteps = dependsOnSteps.filter(e => Boolean(e));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.selectedItem.dependsOnSteps = JSON.stringify(dependsOnSteps) as any;
    }
  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/2-helyos-configuration/admin-dashboard.html#missions-recipes-view', '_blank');
  }


}
