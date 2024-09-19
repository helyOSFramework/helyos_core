import { Component, OnInit } from '@angular/core';
import { HelyosService } from '../../services/helyos.service';
import { H_Assignment, H_WorkProcess } from 'helyosjs-sdk';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-dispatch-processes',
  templateUrl: './dispatch-processes.component.html',
  styleUrls: ['./dispatch-processes.component.scss'],
})
export class DispatchProcessesComponent implements OnInit {
  public wProcesses: H_WorkProcess[];
  public selectedItem: H_WorkProcess;
  public startDate_ngbDateStruct: NgbDateStruct;
  public assignments: H_Assignment[];
  public filterObj: Partial<H_WorkProcess> = {};
  public first: number = 15;
  public page: number = 1;
  public active = 1;
  public availableMissions: string[] = [];
  public yardId: string | number;
  public availableYardIds: (string | number)[];
  public operationTypesRequired: string;

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
    this.helyosService.methods.yard.list().then(yards => {
      this.availableYardIds = yards.map(y => y.id);
    });
    this.helyosService.methods.workProcessType.list({}).then(wpTypes => {
      this.availableMissions = wpTypes.map(wp => wp.name);
    });
  }


  list() {
    const offset = (this.page - 1) * this.first;
    return this.helyosService.methods.workProcess.list(this.filterObj, this.first, offset)
      .then(r => this.wProcesses = r);
  }

  filterList(pageDelta: number = 0) {
    this.page += pageDelta;
    if (this.page < 1) {
      this.page = 1;
    }
    this.filterObj = {};
    this.list();
  }


  create() {
    this.helyosService.methods.yard.list()
      .then((yards) => {
        if (yards.length === 0) {
          alert("You need to register at least one Yard before creating a mission.");
          throw new Error("No yard");
        }
        this.availableYardIds = yards.map(y => y.id);
        if (!this.availableYardIds.includes(this.yardId)) this.yardId = this.availableYardIds[0];
      })
      .then(() => {
        const id = this.yardId;
        const yardId = typeof id === 'string' ? Number(id) : id;
        const newItem = { status: 'draft', workProcessTypeName: 'undefined', yardId: yardId };
        this.helyosService.methods.workProcess.create(newItem)
          .then(r => {
            console.log("helyosService.methods.workProcess.create", r);
            this.list().then(() => setTimeout(() => this.getItem(r.id), 200));
          });
      });
  }


  duplicate() {
    const workProcessId = `${this.selectedItem.id}`;
    this.helyosService.methods.workProcess.get(workProcessId)
      .then(wprocess => {
        const newItem = { ...wprocess, status: 'draft' };
        delete newItem.id;
        delete newItem.__typename;
        this.helyosService.methods.workProcess.create(newItem)
          .then(r => {
            console.log(r);
            this.list().then(() => setTimeout(() => this.getItem(r.id), 200));
          });
      });
  }


  getItem(itemId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.helyosService.methods.workProcess.get(itemId).then((r: any) => {
      if (r.message) {
        alert(r.message);
        return;
      }
      this.selectedItem = r;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.selectedItem['agentIds'] = JSON.stringify(r['agentIds']) as any;
      if (r.operationTypesRequired) {
        this.operationTypesRequired = r.operationTypesRequired.join(', ');
      }
      this.assignmentList();
      if (this.selectedItem.schedStartAt) {
        return;
      }
    });

  }


  cancelMission(itemId) {
    if (confirm("Cancel all assignments that belong to this mission?")) {
      this.editItem(itemId, 'canceling');
    }
  }


  editItem(item, status = null) {
    if (status) {
      item.status = status;
    }

    const patch = { ...item };
    delete patch.operationTypesRequired;


    if (!item['agentIds']) {
      patch['agentIds'] = [];
    } else {
      try {
        patch['agentIds'] = JSON.parse(item['agentIds']);
      } catch (error) {
        alert('error: Agent Ids must be an array of numbers.');
        return;
      }
    }

    if (item['yardId']) {
      if (this.availableYardIds.includes(item['yardId'])) {
        this.yardId = item['yardId'];
      } else {
        alert('Warning: this yard may not exist.');
      }
    }

    if (!this.operationTypesRequired) {
      patch['operationTypesRequired'] = [];
    } else {
      try {
        const jsonArray = this.operationTypesRequired.split(',').map(element => element.trim());
        patch['operationTypesRequired'] = jsonArray;
      } catch (error) {
        alert('error: operationTypesRequired must be an array of strings.');
        return;
      }
    }


    delete patch.createdAt;
    delete patch.modifiedAt;
    const commonErrors = `\nDid you set an inexistent yard id or mission queue id?`;
    this.helyosService.methods.workProcess.patch(patch)
      .then(r => {
        if (r.message) {
          const message = r.message + commonErrors;
          alert(message);
        } else {
          this.list();
          alert('changes saved');
        }
      }).catch(e => {
        alert(JSON.stringify(e));
      });
  }


  assignmentList() {
    const id = this.selectedItem.id;
    const workProcessId = typeof id === 'string' ? Number(id) : id;
    this.helyosService.methods.assignments.list({ workProcessId: workProcessId })
      .then(r => this.assignments = r);

  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/4-helyos-and-microservices/helyos-request.html#mission-request', '_blank');
  }
}
