import { Component, OnInit } from '@angular/core';
import { HelyosService } from '../../services/helyos.service';
import { H_WorkProcess } from 'helyosjs-sdk';
import { H_ServiceRequest } from 'helyosjs-sdk/dist/helyos.models';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-dispatch-services',
    templateUrl: './dispatch-services.component.html',
    styleUrls: ['./dispatch-services.component.scss']
})
export class DispatchServicesComponent implements OnInit {
    public items: H_ServiceRequest[];
    public selectedItem: H_ServiceRequest;
    public startDate_ngbDateStruct: NgbDateStruct;
    public wprocess: H_WorkProcess;
    public selectedItemYardContext: string;
    public selectedItemDepsContext: string;
    public filterObj: Partial<H_ServiceRequest> = {};
    public first: number = 15;
    public page: number = 1;
    public filterWprocId = null;

    constructor(private helyosService: HelyosService) {

    }

    ngOnInit() {
        this.list();
    }


    list() {
        const offset = (this.page - 1)*this.first;
        return this.helyosService.methods.servciceRequests.list(this.filterObj, this.first, offset)
            .then( r => this.items = r );
    }
    
    filterList(pageDelta:number=0) {
        this.page += pageDelta;
        if (this.page < 1){
            this.page = 1;
        }
        this.filterObj = {};
        if (this.filterWprocId) {
            this.filterObj['workProcessId'] = this.filterWprocId;
        }

        this.list();
    }

    getItem(itemId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.helyosService.methods.servciceRequests.get(itemId).then( (r: any)=> {
            this.selectedItem = r;  
            console.log(r) 
            this.selectedItem['agentIds'] = JSON.stringify(r['agentIds']);
            try {
                const context = JSON.parse(this.selectedItem.context);
                this.selectedItemYardContext = JSON.stringify({'map':context.map, 'agents': context.agents}, null, 3);
                this.selectedItemDepsContext = JSON.stringify({'dependencies':context.dependencies}, null, 3);
            } catch (error) {
                return;
            }
            if(this.selectedItem.workProcessId) {
                this.helyosService.methods.workProcess.get(this.selectedItem.workProcessId.toString())
                    .then(wp => this.wprocess = wp);
            }
        })

    }

    timeDifference(date1:string, date2:string) {
        if (!(date1 && date2)) {return ''}
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return `${Math.round((d1.getTime() - d2.getTime())/1000)} secs`;
    }



}
