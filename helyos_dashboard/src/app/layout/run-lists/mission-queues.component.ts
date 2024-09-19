import { Component, OnInit } from '@angular/core';
import { HelyosService } from '../../services/helyos.service';
import { H_MissionQueue, H_WorkProcess } from 'helyosjs-sdk';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-mission-queues',
  templateUrl: './mission-queues.component.html',
  styleUrls: ['./mission-queues.component.scss'],
})
export class RunListsComponent implements OnInit {
  public mQueues: H_MissionQueue[];
  public selectedItem: H_WorkProcess;
  public startDate_ngbDateStruct: NgbDateStruct;
  public wProcesses: H_WorkProcess[];

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
  }

  list() {
    return this.helyosService.methods.missionQueue.list({})
      .then(r => this.mQueues = r);
  }

  missionList() {
    return this.helyosService.methods.workProcess.list({
      missionQueueId: this.selectedItem.id as number, 
    }, 99999, 0, 'RUN_ORDER_ASC')
      .then(r => this.wProcesses = r);
  }

  create() {
    const now = new Date();
    const newName = 'run-list ' + now.toLocaleTimeString();
    const newItem = {
      status: 'stopped',
      name: newName, 
    };
    this.helyosService.methods.missionQueue.create(newItem)
      .then(r => {
        console.log(r);
        this.list().then(() => this.getItem(r.id));
      });
  }

  getItem(itemId) {
    this.helyosService.methods.missionQueue.get(itemId)
      .then((r: H_WorkProcess) => {
        this.selectedItem = r;
        this.missionList();
      });

  }

  deleteItem(itemId) {
    this.helyosService.methods.missionQueue.delete(itemId)
      .then((_) => {
        this.list();
        this.selectedItem = null;
      });
  }

  editItem(item, status = null) {
    if (status) {
      item.status = status;
    }

    const patch = {
      ...item, 
    };

    console.log(item);

    delete patch.createdAt;
    delete patch.modifiedAt;

    this.helyosService.methods.missionQueue.patch(patch)
      .then((_) => {
        this.list();
      }).catch(e => {
        alert(JSON.stringify(e));
      });
  }

  onStatusChange(ev) {
    const newValue = ev.target.value;
    if (newValue !== 'running' && newValue !== 'stopped') {
      this.selectedItem.status = newValue;
    } else {
      ev.target.value = this.selectedItem.status;
    }
  }

  openDocs() {
    window.open('https://helyos-manual.readthedocs.io/en/latest/4-helyos-and-microservices/helyos-request.html#mission-request', '_blank');
  }
}
