import { Component } from '@angular/core';

@Component({
    selector: 'app-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
    collapedSideBar: boolean;

    constructor() {}

    receiveCollapsed($event) {
        this.collapedSideBar = $event;
    }
}
