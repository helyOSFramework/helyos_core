import { Component, OnInit } from '@angular/core';
import { HelyosService } from '../../services/helyos.service';
import { H_WorkProcess } from 'helyosjs-sdk';
import { H_ServiceRequest, ToolPose } from 'helyosjs-sdk/dist/helyos.models';
import { NgbDate, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

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
    public filterObj: any = {};
    public first: number = 15;
    public page: number = 1;

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
            this.list();
        }

    getItem(itemId) {
        this.helyosService.methods.servciceRequests.get(itemId)
        .then( (r:any)=> {
            this.selectedItem = r;   
            this.selectedItem['agentIds'] = JSON.stringify(r['agentIds']) as any;
            try {
                const context = JSON.parse(this.selectedItem.context);
                this.selectedItemYardContext = JSON.stringify({'map':context.map, 'agents': context.agents}, null, 3);
                this.selectedItemDepsContext = JSON.stringify({'dependencies':context.dependencies}, null, 3);
            } catch (error) {
                
            }
            if(this.selectedItem.workProcessId) {
                this.helyosService.methods.workProcess.get(this.selectedItem.workProcessId.toString())
                .then(wp => this.wprocess = wp);
            }
        })

    }

    timeDifference(date1:string, date2:string) {
        if (!(date1 && date2)) {return ''}
        const d1 = new Date(date1) as any;
        const d2 = new Date(date2) as any;
        return `${Math.round((d1 - d2)/1000)} secs`;
    }



}
