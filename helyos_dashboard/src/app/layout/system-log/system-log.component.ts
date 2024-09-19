import { Component, OnDestroy, OnInit } from '@angular/core';
import { H_SystemLog } from 'helyosjs-sdk';
import { HelyosService } from '../../services/helyos.service';

@Component({
  selector: 'app-system-log',
  templateUrl: './system-log.component.html',
  styleUrls: ['./system-log.component.scss']
})
export class SystemLogComponent implements OnInit, OnDestroy {
  public logs: H_SystemLog[];
  public selectedItem: H_SystemLog;
  public showDescription: boolean = false;
  public filterOrigin: string = 'all';
  public filterWprocId: number | null = null;
  public filterObj: Partial<H_SystemLog> = {};
  public filterAgentUuid: string = '';
  public first: number = 50;
  public page: number = 1;
  private reloadTimer;
  public autoReload = true;

  constructor(private helyosService: HelyosService) {

  }

  ngOnInit() {
    this.list();
    this.reloadLoop();
  }

  ngOnDestroy(): void {
    clearInterval(this.reloadTimer);
  }


  list() {
    try {
      const offset = (this.page - 1) * this.first;
      return this.helyosService.methods.systemLogs.list(this.filterObj, this.first, offset)
        .then(r => this.logs = r)
        .catch(() => { });

    } catch (error) {
      return;
    }

  }

  reloadLoop() {
    this.reloadTimer = setInterval(() => {
      if (this.autoReload) {
        this.list();
      }
    }, 4000);
  }

  getItem(_id) {

  }

  filterList(pageDelta: number = 0) {
    this.page += pageDelta;
    if (this.page < 1) {
      this.page = 1;
    }
    this.filterObj = {};
    if (this.filterWprocId) {
      this.filterObj['wprocId'] = this.filterWprocId;
    }

    if (this.filterOrigin && this.filterOrigin !== 'all') {
      this.filterObj['origin'] = this.filterOrigin;
    }

    if (this.filterAgentUuid) {
      this.filterObj['agentUuid'] = this.filterAgentUuid;
    }

    this.list();

  }
}
